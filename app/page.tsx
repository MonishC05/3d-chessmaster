import { Show } from "@clerk/nextjs";
import { ArrowRight, Bot, Crown, Globe2, Sparkles } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const features = [
  { icon: Globe2, title: "Live matchmaking", copy: "Realtime games with signed-in players, synced move by move." },
  { icon: Bot, title: "Five engine levels", copy: "Start with a forgiving beginner or challenge grandmaster strength." },
  { icon: Sparkles, title: "A board that teaches", copy: "Pro players can ask why, see a move, and learn the idea behind it." },
];

export default function HomePage() {
  return (
    <div className="overflow-hidden">
      <section className="mx-auto grid max-w-7xl gap-14 px-6 py-20 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:py-28">
        <div>
          <Badge variant="outline" className="mb-5 border-emerald-500/30 bg-emerald-500/10 text-emerald-300">Chess, with depth</Badge>
          <h1 className="max-w-3xl text-balance text-5xl font-semibold tracking-[-0.055em] sm:text-6xl lg:text-7xl">
            See the whole board. Then see one move further.
          </h1>
          <p className="mt-6 max-w-2xl text-pretty text-lg leading-8 text-muted-foreground">
            A focused 3D chess room for live matches, Stockfish practice, and conversational coaching that explains the position in plain English.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Show when="signed-in"><Button asChild size="lg"><Link href="/play">Enter the chess room <ArrowRight /></Link></Button></Show>
            <Show when="signed-out">
              <Button asChild size="lg"><Link href="/sign-up">Create an account <ArrowRight /></Link></Button>
              <Button asChild size="lg" variant="outline"><Link href="/sign-in">Sign in</Link></Button>
            </Show>
          </div>
        </div>
        <div className="relative mx-auto aspect-square w-full max-w-xl rounded-[2.5rem] border border-white/10 bg-zinc-950/60 p-8 shadow-2xl shadow-emerald-950/30">
          <div className="absolute inset-10 rotate-3 rounded-2xl bg-[conic-gradient(from_90deg,#173b32_25%,#d4ccb4_0_50%,#173b32_0_75%,#d4ccb4_0)] bg-[length:25%_25%] shadow-[0_35px_80px_-20px_rgba(0,0,0,.8)] [transform:perspective(700px)_rotateX(55deg)_rotateZ(-8deg)]" />
          <div className="absolute bottom-12 left-12 rounded-2xl border border-white/10 bg-black/70 p-4 backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-full bg-emerald-400 text-zinc-950"><Crown className="size-5" /></div>
              <div><p className="text-sm font-medium">Coach insight</p><p className="text-xs text-zinc-400">Control the open file first.</p></div>
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-6 pb-24">
        <div className="grid gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 md:grid-cols-3">
          {features.map(({ icon: Icon, title, copy }) => (
            <div className="bg-background/95 p-8" key={title}>
              <Icon className="size-6 text-emerald-400" />
              <h2 className="mt-6 text-lg font-medium">{title}</h2>
              <p className="mt-2 leading-7 text-muted-foreground">{copy}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
