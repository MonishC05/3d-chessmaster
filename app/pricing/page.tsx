import { PricingTable } from "@clerk/nextjs";
import { Check, Sparkles } from "lucide-react";

export default function PricingPage() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <div className="mx-auto max-w-2xl text-center">
        <p className="inline-flex items-center gap-2 text-sm font-medium text-emerald-400"><Sparkles className="size-4" /> Pro coaching</p>
        <h1 className="mt-4 text-5xl font-semibold tracking-tight">Turn every position into a lesson.</h1>
        <p className="mt-5 text-lg leading-8 text-muted-foreground">See Stockfish&apos;s recommendation on the board, then ask your AI tutor why it works and what to watch for next.</p>
      </div>
      <div className="mx-auto mt-10 grid max-w-2xl gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 sm:grid-cols-3">
        {["Visual best-move arrows", "Position-aware explanations", "Interactive follow-up chat"].map((item) => <p className="flex items-center gap-2 text-sm" key={item}><Check className="size-4 text-emerald-400" />{item}</p>)}
      </div>
      <div className="mt-12"><PricingTable /></div>
      <p className="mt-6 text-center text-xs text-muted-foreground">Plans, checkout, renewals, and access are managed directly by Clerk Billing.</p>
    </section>
  );
}
