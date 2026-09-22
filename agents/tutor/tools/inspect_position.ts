import { Chess } from "chess.js";
import { defineTool } from "eve/tools";
import { z } from "zod";

const pieceValues = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 } as const;

export default defineTool({
  description: "Inspect a chess position for a Clerk-authorized Pro tutor explanation.",
  inputSchema: z.object({
    fen: z.string().min(1),
    engineMove: z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/).optional(),
  }),
  execute({ fen, engineMove }, ctx) {
    const current = ctx.session.auth.current;
    const initiator = ctx.session.auth.initiator;
    const isSessionOwner =
      current?.principalType === "user" &&
      initiator?.principalType === "user" &&
      current.principalId === initiator.principalId;
    const hasTutorEntitlement =
      current?.attributes.aiTutor === "true" &&
      initiator?.attributes.aiTutor === "true";

    if (!isSessionOwner) {
      return { authorized: false, reason: "session_owner_mismatch" } as const;
    }
    if (!hasTutorEntitlement) {
      return { authorized: false, reason: "upgrade_required" } as const;
    }

    let chess: Chess;
    try {
      chess = new Chess(fen);
    } catch {
      return { authorized: true, valid: false, reason: "invalid_fen" } as const;
    }

    const material = { white: 0, black: 0 };
    for (const row of chess.board()) {
      for (const piece of row) {
        if (piece) {
          material[piece.color === "w" ? "white" : "black"] += pieceValues[piece.type];
        }
      }
    }

    const legalMoves = chess.moves({ verbose: true }).slice(0, 40).map((move) => ({
      capture: Boolean(move.captured),
      san: move.san,
      uci: `${move.from}${move.to}${move.promotion ?? ""}`,
    }));
    const recommendation = engineMove
      ? legalMoves.find((move) => move.uci === engineMove) ?? null
      : null;

    return {
      authorized: true,
      valid: true,
      turn: chess.turn() === "w" ? "white" : "black",
      inCheck: chess.inCheck(),
      material,
      legalMoveCount: chess.moves().length,
      recommendation,
      legalMoves,
    } as const;
  },
});
