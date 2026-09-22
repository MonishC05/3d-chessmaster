import { Gamepad2, Globe2, GraduationCap } from "lucide-react";
import { PlayLobby } from "@/components/chess/play-lobby";

export default function PlayPage() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-12">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-emerald-400"><Gamepad2 className="size-4" /> Chess room</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">Choose your next game</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">Find a live opponent or train against Stockfish at the level that feels right today.</p>
        </div>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><Globe2 className="size-4 text-emerald-400" /> Realtime</span>
          <span className="flex items-center gap-1.5"><GraduationCap className="size-4 text-amber-400" /> Tutor ready</span>
        </div>
      </div>
      <PlayLobby />
    </section>
  );
}
