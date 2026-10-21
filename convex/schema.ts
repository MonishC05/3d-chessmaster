import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const gameStatus = v.union(
  v.literal("active"),
  v.literal("completed"),
  v.literal("abandoned"),
);

const timeControl = v.union(
  v.literal("rapid"),
  v.literal("blitz"),
  v.literal("bullet"),
);

export default defineSchema({
  players: defineTable({
    clerkUserId: v.string(),
    displayName: v.string(),
    imageUrl: v.optional(v.string()),
    rating: v.number(),
    wins: v.number(),
    losses: v.number(),
    draws: v.number(),
    updatedAt: v.number(),
  }).index("by_clerk_user_id", ["clerkUserId"]),

  matchmakingTickets: defineTable({
    playerId: v.id("players"),
    status: v.union(
      v.literal("waiting"),
      v.literal("matched"),
      v.literal("cancelled"),
      v.literal("consumed"),
    ),
    timeControl,
    rating: v.number(),
    gameId: v.optional(v.id("games")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_player_id_and_status", ["playerId", "status"])
    .index("by_status_time_control_and_rating", ["status", "timeControl", "rating"])
    .index("by_game_id", ["gameId"]),

  games: defineTable({
    mode: v.union(v.literal("online"), v.literal("ai")),
    status: gameStatus,
    currentFen: v.string(),
    turn: v.union(v.literal("w"), v.literal("b")),
    result: v.optional(v.union(v.literal("1-0"), v.literal("0-1"), v.literal("1/2-1/2"))),
    endReason: v.optional(v.string()),
    ownerPlayerId: v.optional(v.id("players")),
    difficulty: v.optional(v.number()),
    timeControl: v.optional(timeControl),
    moveCount: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner_player_id", ["ownerPlayerId"])
    .index("by_status", ["status"]),

  gamePlayers: defineTable({
    gameId: v.id("games"),
    playerId: v.id("players"),
    color: v.union(v.literal("w"), v.literal("b")),
    ratingBefore: v.number(),
    ratingAfter: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_game_id", ["gameId"])
    .index("by_player_id", ["playerId"])
    .index("by_game_id_and_player_id", ["gameId", "playerId"]),

  moves: defineTable({
    gameId: v.id("games"),
    ply: v.number(),
    from: v.string(),
    to: v.string(),
    promotion: v.optional(v.string()),
    san: v.string(),
    uci: v.string(),
    fenAfter: v.string(),
    actor: v.union(v.literal("player"), v.literal("opponent"), v.literal("ai")),
    createdAt: v.number(),
  }).index("by_game_id_and_ply", ["gameId", "ply"]),

  tutorSessions: defineTable({
    ownerPlayerId: v.id("players"),
    gameId: v.id("games"),
    eveSessionId: v.string(),
    status: v.union(v.literal("active"), v.literal("closed")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner_player_id", ["ownerPlayerId"])
    .index("by_game_id", ["gameId"])
    .index("by_eve_session_id", ["eveSessionId"]),

  tutorUsage: defineTable({
    ownerPlayerId: v.id("players"),
    gameId: v.id("games"),
    tutorSessionId: v.optional(v.id("tutorSessions")),
    kind: v.union(v.literal("chat"), v.literal("hint"), v.literal("analysis")),
    createdAt: v.number(),
  })
    .index("by_owner_player_id", ["ownerPlayerId"])
    .index("by_game_id", ["gameId"])
    .index("by_tutor_session_id", ["tutorSessionId"]),
});
