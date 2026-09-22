import type { Id } from "@/convex/_generated/dataModel";
import { GameRoom } from "@/components/chess/game-room";
import { PlayerProfileSync } from "@/components/player-profile-sync";

export default async function GamePage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  return <><PlayerProfileSync /><GameRoom gameId={gameId as Id<"games">} /></>;
}
