import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

declare global {
  interface ImportMeta {
    glob(pattern: string): Record<string, () => Promise<unknown>>;
  }
}

const modules = import.meta.glob("./**/*.ts");

function user(testBackend: ReturnType<typeof convexTest>, id: string) {
  return testBackend.withIdentity({
    subject: id,
    issuer: "https://clerk.test",
    tokenIdentifier: `https://clerk.test|${id}`,
  });
}

async function createPlayer(testBackend: ReturnType<typeof convexTest>, id: string) {
  const asUser = user(testBackend, id);
  await asUser.mutation(api.chess.ensurePlayer, { displayName: id });
  return asUser;
}

describe("chess backend authorization and game rules", () => {
  test("requires authentication to create a player", async () => {
    const t = convexTest(schema, modules);
    await expect(t.mutation(api.chess.ensurePlayer, { displayName: "Anonymous" })).rejects.toThrow("signed in");
  });

  test("isolates AI games by owner and enforces turns", async () => {
    const t = convexTest(schema, modules);
    const alice = await createPlayer(t, "alice");
    const bob = await createPlayer(t, "bob");
    const gameId = await alice.mutation(api.chess.createAiGame, { difficulty: 2 });

    await expect(bob.query(api.chess.getGame, { gameId })).rejects.toThrow("access");
    await alice.mutation(api.chess.submitMove, { gameId, from: "e2", to: "e4" });
    await expect(alice.mutation(api.chess.submitMove, { gameId, from: "d2", to: "d4" })).rejects.toThrow("engine");
    await alice.mutation(api.chess.submitMove, { gameId, from: "e7", to: "e5", asAi: true });
    const game = await alice.query(api.chess.getGame, { gameId });
    expect(game.moves.map((move) => move.uci)).toEqual(["e2e4", "e7e5"]);
  });

  test("matches two different users into the same online game", async () => {
    const t = convexTest(schema, modules);
    const alice = await createPlayer(t, "alice");
    const bob = await createPlayer(t, "bob");
    const waiting = await alice.mutation(api.chess.joinMatchmaking, { timeControl: "rapid" });
    expect(waiting.gameId).toBeUndefined();
    const matched = await bob.mutation(api.chess.joinMatchmaking, { timeControl: "rapid" });
    expect(matched.gameId).toBeDefined();
    const aliceTicket = await alice.query(api.chess.myMatchmakingTicket, {});
    expect(aliceTicket?.gameId).toEqual(matched.gameId);
  });

  test("never records tutor usage for an online game", async () => {
    const t = convexTest(schema, modules);
    const alice = await createPlayer(t, "alice");
    const bob = await createPlayer(t, "bob");
    await alice.mutation(api.chess.joinMatchmaking, { timeControl: "blitz" });
    const { gameId } = await bob.mutation(api.chess.joinMatchmaking, { timeControl: "blitz" });
    expect(gameId).toBeDefined();
    await expect(bob.mutation(api.chess.recordTutorUsage, {
      gameId: gameId!,
      eveSessionId: "eve-test",
      kind: "chat",
    })).rejects.toThrow("computer games");
  });
});
