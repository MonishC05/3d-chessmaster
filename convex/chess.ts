import { Chess } from "chess.js";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";

const STARTING_FEN = new Chess().fen();
const timeControlValidator = v.union(
  v.literal("rapid"),
  v.literal("blitz"),
  v.literal("bullet"),
);
const gameStatusValidator = v.union(v.literal("active"), v.literal("completed"), v.literal("abandoned"));
const resultValidator = v.union(v.literal("1-0"), v.literal("0-1"), v.literal("1/2-1/2"));
const squarePattern = /^[a-h][1-8]$/;

type AppCtx = QueryCtx | MutationCtx;

async function authenticatedClerkUserId(ctx: Pick<AppCtx, "auth">) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError("You must be signed in.");
  return identity.tokenIdentifier;
}

async function currentPlayer(ctx: AppCtx) {
  const clerkUserId = await authenticatedClerkUserId(ctx);
  const player = await ctx.db
    .query("players")
    .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", clerkUserId))
    .unique();
  if (!player) throw new ConvexError("Create your player profile first.");
  return player as Doc<"players">;
}

function resultFor(chess: Chess) {
  if (chess.isCheckmate()) return chess.turn() === "w" ? "0-1" as const : "1-0" as const;
  if (chess.isDraw()) return "1/2-1/2" as const;
  return undefined;
}

async function applyOnlineResult(ctx: MutationCtx, gameId: Id<"games">, result: "1-0" | "0-1" | "1/2-1/2") {
  const seats = await ctx.db
    .query("gamePlayers")
    .withIndex("by_game_id", (q) => q.eq("gameId", gameId))
    .take(2);
  if (seats.length !== 2) return;
  const whiteSeat = seats.find((seat) => seat.color === "w");
  const blackSeat = seats.find((seat) => seat.color === "b");
  if (!whiteSeat || !blackSeat) return;
  const white = await ctx.db.get(whiteSeat.playerId);
  const black = await ctx.db.get(blackSeat.playerId);
  if (!white || !black) return;
  const whiteScore = result === "1-0" ? 1 : result === "0-1" ? 0 : 0.5;
  const blackScore = 1 - whiteScore;
  const whiteExpected = 1 / (1 + 10 ** ((black.rating - white.rating) / 400));
  const blackExpected = 1 - whiteExpected;
  const whiteRating = Math.max(100, Math.round(white.rating + 32 * (whiteScore - whiteExpected)));
  const blackRating = Math.max(100, Math.round(black.rating + 32 * (blackScore - blackExpected)));
  const stats = (score: number, player: Doc<"players">) => ({
    wins: player.wins + (score === 1 ? 1 : 0),
    losses: player.losses + (score === 0 ? 1 : 0),
    draws: player.draws + (score === 0.5 ? 1 : 0),
  });
  await ctx.db.patch(white._id, { rating: whiteRating, ...stats(whiteScore, white), updatedAt: Date.now() });
  await ctx.db.patch(black._id, { rating: blackRating, ...stats(blackScore, black), updatedAt: Date.now() });
  await ctx.db.patch(whiteSeat._id, { ratingAfter: whiteRating });
  await ctx.db.patch(blackSeat._id, { ratingAfter: blackRating });
}

async function gameAccess(
  ctx: AppCtx,
  gameId: Id<"games">,
  playerId: Id<"players">,
) {
  const game = await ctx.db.get(gameId) as Doc<"games"> | null;
  if (!game) throw new ConvexError("Game not found.");
  if (game.ownerPlayerId === playerId) return { game, seat: null };
  const seat = await ctx.db
    .query("gamePlayers")
    .withIndex("by_game_id_and_player_id", (q) => q.eq("gameId", gameId).eq("playerId", playerId))
    .unique();
  if (!seat) throw new ConvexError("You do not have access to this game.");
  return { game, seat: seat as Doc<"gamePlayers"> };
}

export const ensurePlayer = mutation({
  args: {
    displayName: v.string(),
    imageUrl: v.optional(v.string()),
  },
  returns: v.id("players"),
  handler: async (ctx, args) => {
    const clerkUserId = await authenticatedClerkUserId(ctx);
    const existing = await ctx.db
      .query("players")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", clerkUserId))
      .unique();
    const now = Date.now();
    const displayName = args.displayName.trim().slice(0, 40) || "Chess player";
    if (existing) {
      await ctx.db.patch(existing._id, { displayName, imageUrl: args.imageUrl, updatedAt: now });
      return existing._id;
    }
    return await ctx.db.insert("players", {
      clerkUserId,
      displayName,
      imageUrl: args.imageUrl,
      rating: 1200,
      wins: 0,
      losses: 0,
      draws: 0,
      updatedAt: now,
    });
  },
});

export const me = query({
  args: {},
  returns: v.union(v.null(), v.object({
    _id: v.id("players"),
    _creationTime: v.number(),
    clerkUserId: v.string(),
    displayName: v.string(),
    imageUrl: v.optional(v.string()),
    rating: v.number(),
    wins: v.number(),
    losses: v.number(),
    draws: v.number(),
    updatedAt: v.number(),
  })),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return await ctx.db
      .query("players")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", identity.tokenIdentifier))
      .unique();
  },
});

export const createAiGame = mutation({
  args: { difficulty: v.number() },
  returns: v.id("games"),
  handler: async (ctx, { difficulty }) => {
    const player = await currentPlayer(ctx);
    if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) {
      throw new ConvexError("Difficulty must be between 1 and 5.");
    }
    const now = Date.now();
    return await ctx.db.insert("games", {
      mode: "ai",
      status: "active",
      currentFen: STARTING_FEN,
      turn: "w",
      ownerPlayerId: player._id,
      difficulty,
      moveCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const joinMatchmaking = mutation({
  args: { timeControl: timeControlValidator },
  returns: v.object({ ticketId: v.id("matchmakingTickets"), gameId: v.optional(v.id("games")) }),
  handler: async (ctx, { timeControl }) => {
    const player = await currentPlayer(ctx);
    const existingTickets = await ctx.db
      .query("matchmakingTickets")
      .withIndex("by_player_id_and_status", (q) => q.eq("playerId", player._id).eq("status", "waiting"))
      .take(2);
    const current = existingTickets[0];
    if (current?.timeControl === timeControl) return { ticketId: current._id, gameId: current.gameId };
    if (current) await ctx.db.patch(current._id, { status: "cancelled", updatedAt: Date.now() });

    const candidates = await ctx.db
      .query("matchmakingTickets")
      .withIndex("by_status_time_control_and_rating", (q) =>
        q.eq("status", "waiting").eq("timeControl", timeControl).gte("rating", player.rating - 300).lte("rating", player.rating + 300),
      )
      .take(25);
    const opponentTicket = candidates.find(
      (ticket) => ticket.playerId !== player._id && ticket.updatedAt >= Date.now() - 30_000,
    );
    const now = Date.now();

    if (!opponentTicket) {
      const ticketId = await ctx.db.insert("matchmakingTickets", {
        playerId: player._id,
        status: "waiting",
        timeControl,
        rating: player.rating,
        createdAt: now,
        updatedAt: now,
      });
      return { ticketId };
    }

    const opponent = await ctx.db.get(opponentTicket.playerId);
    if (!opponent) throw new ConvexError("The matched player no longer exists.");
    const gameId = await ctx.db.insert("games", {
      mode: "online",
      status: "active",
      currentFen: STARTING_FEN,
      turn: "w",
      timeControl,
      moveCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("gamePlayers", {
      gameId,
      playerId: opponent._id,
      color: "w",
      ratingBefore: opponent.rating,
      createdAt: now,
    });
    await ctx.db.insert("gamePlayers", {
      gameId,
      playerId: player._id,
      color: "b",
      ratingBefore: player.rating,
      createdAt: now,
    });
    await ctx.db.patch(opponentTicket._id, { status: "matched", gameId, updatedAt: now });
    const ticketId = await ctx.db.insert("matchmakingTickets", {
      playerId: player._id,
      status: "matched",
      timeControl,
      rating: player.rating,
      gameId,
      createdAt: now,
      updatedAt: now,
    });
    return { ticketId, gameId };
  },
});

export const myMatchmakingTicket = query({
  args: {},
  returns: v.union(v.null(), v.object({
    _id: v.id("matchmakingTickets"),
    status: v.union(v.literal("waiting"), v.literal("matched"), v.literal("cancelled"), v.literal("consumed")),
    gameId: v.optional(v.id("games")),
    timeControl: timeControlValidator,
  })),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const player = await ctx.db
      .query("players")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", identity.tokenIdentifier))
      .unique();
    if (!player) return null;
    const waiting = await ctx.db
      .query("matchmakingTickets")
      .withIndex("by_player_id_and_status", (q) => q.eq("playerId", player._id).eq("status", "waiting"))
      .order("desc")
      .take(1);
    let ticket = waiting[0];
    if (!ticket) {
      const matched = await ctx.db
        .query("matchmakingTickets")
        .withIndex("by_player_id_and_status", (q) => q.eq("playerId", player._id).eq("status", "matched"))
        .order("desc")
        .take(1);
      const candidate = matched[0];
      if (candidate?.gameId) {
        const game = await ctx.db.get(candidate.gameId);
        if (game?.status === "active") ticket = candidate;
      }
    }
    return ticket ? {
      _id: ticket._id,
      status: ticket.status,
      gameId: ticket.gameId,
      timeControl: ticket.timeControl,
    } : null;
  },
});

export const cancelMatchmaking = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const player = await currentPlayer(ctx);
    const tickets = await ctx.db
      .query("matchmakingTickets")
      .withIndex("by_player_id_and_status", (q) => q.eq("playerId", player._id).eq("status", "waiting"))
      .take(10);
    await Promise.all(tickets.map((ticket) => ctx.db.patch(ticket._id, { status: "cancelled", updatedAt: Date.now() })));
    return null;
  },
});

export const heartbeatMatchmaking = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const player = await currentPlayer(ctx);
    const tickets = await ctx.db
      .query("matchmakingTickets")
      .withIndex("by_player_id_and_status", (q) => q.eq("playerId", player._id).eq("status", "waiting"))
      .take(2);
    await Promise.all(tickets.map((ticket) => ctx.db.patch(ticket._id, { updatedAt: Date.now() })));
    return null;
  },
});

export const acknowledgeMatch = mutation({
  args: { gameId: v.id("games") },
  returns: v.null(),
  handler: async (ctx, { gameId }) => {
    const player = await currentPlayer(ctx);
    const tickets = await ctx.db
      .query("matchmakingTickets")
      .withIndex("by_player_id_and_status", (q) => q.eq("playerId", player._id).eq("status", "matched"))
      .take(10);
    const ticket = tickets.find((candidate) => candidate.gameId === gameId);
    if (ticket) await ctx.db.patch(ticket._id, { status: "consumed", updatedAt: Date.now() });
    return null;
  },
});

export const getGame = query({
  args: { gameId: v.id("games") },
  returns: v.object({
    game: v.object({
      _id: v.id("games"),
      mode: v.union(v.literal("online"), v.literal("ai")),
      status: gameStatusValidator,
      currentFen: v.string(),
      turn: v.union(v.literal("w"), v.literal("b")),
      result: v.optional(resultValidator),
      endReason: v.optional(v.string()),
      difficulty: v.optional(v.number()),
      timeControl: v.optional(timeControlValidator),
      moveCount: v.number(),
    }),
    moves: v.array(v.object({
      _id: v.id("moves"),
      ply: v.number(),
      from: v.string(),
      to: v.string(),
      san: v.string(),
      uci: v.string(),
    })),
    players: v.array(v.object({
      color: v.union(v.literal("w"), v.literal("b")),
      player: v.union(v.null(), v.object({
        displayName: v.string(),
        imageUrl: v.optional(v.string()),
        rating: v.number(),
      })),
    })),
    myColor: v.union(v.literal("w"), v.literal("b")),
  }),
  handler: async (ctx, { gameId }) => {
    const player = await currentPlayer(ctx);
    const { game, seat } = await gameAccess(ctx, gameId, player._id);
    const moves = await ctx.db
      .query("moves")
      .withIndex("by_game_id_and_ply", (q) => q.eq("gameId", gameId))
      .take(512);
    const seats = await ctx.db
      .query("gamePlayers")
      .withIndex("by_game_id", (q) => q.eq("gameId", gameId))
      .take(2);
    const players = await Promise.all(seats.map(async (gameSeat) => {
      const profile = await ctx.db.get(gameSeat.playerId);
      return {
        color: gameSeat.color,
        player: profile ? { displayName: profile.displayName, imageUrl: profile.imageUrl, rating: profile.rating } : null,
      };
    }));
    return {
      game: {
        _id: game._id,
        mode: game.mode,
        status: game.status,
        currentFen: game.currentFen,
        turn: game.turn,
        result: game.result,
        endReason: game.endReason,
        difficulty: game.difficulty,
        timeControl: game.timeControl,
        moveCount: game.moveCount,
      },
      moves: moves.map((move) => ({ _id: move._id, ply: move.ply, from: move.from, to: move.to, san: move.san, uci: move.uci })),
      players,
      myColor: seat?.color ?? "w",
    };
  },
});

export const submitMove = mutation({
  args: {
    gameId: v.id("games"),
    from: v.string(),
    to: v.string(),
    promotion: v.optional(v.string()),
    asAi: v.optional(v.boolean()),
  },
  returns: v.object({ fen: v.string(), status: v.string() }),
  handler: async (ctx, args) => {
    const player = await currentPlayer(ctx);
    const { game, seat } = await gameAccess(ctx, args.gameId, player._id);
    if (game.status !== "active") throw new ConvexError("This game has ended.");
    if (!squarePattern.test(args.from) || !squarePattern.test(args.to)) throw new ConvexError("Move coordinates are invalid.");
    if (args.promotion && !/^[qrbn]$/.test(args.promotion)) throw new ConvexError("Promotion piece is invalid.");

    let actor: "player" | "opponent" | "ai" = "player";
    if (game.mode === "ai") {
      if (args.asAi) {
        if (game.turn !== "b") throw new ConvexError("It is not the engine's turn.");
        actor = "ai";
      } else if (game.turn !== "w") {
        throw new ConvexError("Wait for the engine to move.");
      }
    } else {
      if (!seat || seat.color !== game.turn) throw new ConvexError("It is not your turn.");
      actor = seat.color === "w" ? "player" : "opponent";
    }

    const chess = new Chess(game.currentFen);
    let move;
    try {
      move = chess.move({
        from: args.from,
        to: args.to,
        promotion: args.promotion ?? "q",
      });
    } catch {
      throw new ConvexError("That move is not legal.");
    }
    if (!move) throw new ConvexError("That move is not legal.");

    const result = resultFor(chess);
    const status = result ? "completed" as const : "active" as const;
    const now = Date.now();
    await ctx.db.insert("moves", {
      gameId: game._id,
      ply: game.moveCount + 1,
      from: move.from,
      to: move.to,
      promotion: move.promotion,
      san: move.san,
      uci: `${move.from}${move.to}${move.promotion ?? ""}`,
      fenAfter: chess.fen(),
      actor,
      createdAt: now,
    });
    await ctx.db.patch(game._id, {
      currentFen: chess.fen(),
      turn: chess.turn(),
      moveCount: game.moveCount + 1,
      status,
      result,
      endReason: result ? (chess.isCheckmate() ? "checkmate" : "draw") : undefined,
      updatedAt: now,
    });
    if (result && game.mode === "online") await applyOnlineResult(ctx, game._id, result);
    return { fen: chess.fen(), status };
  },
});

export const recordTutorUsage = mutation({
  args: {
    gameId: v.id("games"),
    eveSessionId: v.string(),
    kind: v.union(v.literal("chat"), v.literal("hint"), v.literal("analysis")),
  },
  returns: v.id("tutorUsage"),
  handler: async (ctx, args) => {
    const player = await currentPlayer(ctx);
    await gameAccess(ctx, args.gameId, player._id);
    let session = await ctx.db
      .query("tutorSessions")
      .withIndex("by_eve_session_id", (q) => q.eq("eveSessionId", args.eveSessionId))
      .unique();
    const now = Date.now();
    if (session && session.ownerPlayerId !== player._id) {
      throw new ConvexError("Tutor session ownership mismatch.");
    }
    const game = await ctx.db.get(args.gameId);
    if (!game || game.mode !== "ai") throw new ConvexError("Tutor usage is only recorded for computer games.");
    if (session && (session.gameId !== args.gameId || session.status !== "active")) {
      throw new ConvexError("Tutor session is not active for this game.");
    }
    if (!session) {
      const sessionId = await ctx.db.insert("tutorSessions", {
        ownerPlayerId: player._id,
        gameId: args.gameId,
        eveSessionId: args.eveSessionId,
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      session = await ctx.db.get(sessionId);
    } else {
      await ctx.db.patch(session._id, { updatedAt: now });
    }
    return await ctx.db.insert("tutorUsage", {
      ownerPlayerId: player._id,
      gameId: args.gameId,
      tutorSessionId: session?._id,
      kind: args.kind,
      createdAt: now,
    });
  },
});
