"use client";

import { useMutation, useQuery } from "convex/react";
import { Bot, Crown, LoaderCircle, Radio, Swords, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const difficulties = [
  { level: 1, name: "Beginner", detail: "Learning legal patterns", elo: "~800" },
  { level: 2, name: "Club", detail: "Developing tactical vision", elo: "~1200" },
  { level: 3, name: "Challenger", detail: "Solid positional play", elo: "~1600" },
  { level: 4, name: "Master", detail: "Deep calculation", elo: "~2100" },
  { level: 5, name: "Grandmaster", detail: "Strongest local challenge", elo: "Expert+" },
];

export function PlayLobby() {
  const router = useRouter();
  const profile = useQuery(api.chess.me);
  const ticket = useQuery(api.chess.myMatchmakingTicket);
  const createAiGame = useMutation(api.chess.createAiGame);
  const joinMatchmaking = useMutation(api.chess.joinMatchmaking);
  const cancelMatchmaking = useMutation(api.chess.cancelMatchmaking);
  const heartbeatMatchmaking = useMutation(api.chess.heartbeatMatchmaking);
  const [difficulty, setDifficulty] = useState("2");
  const [timeControl, setTimeControl] = useState<"rapid" | "blitz" | "bullet">("rapid");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (ticket?.status === "matched" && ticket.gameId) router.push(`/game/${ticket.gameId}`);
  }, [router, ticket]);

  useEffect(() => {
    if (ticket?.status !== "waiting") return;
    void heartbeatMatchmaking();
    const timer = window.setInterval(() => void heartbeatMatchmaking(), 10_000);
    return () => window.clearInterval(timer);
  }, [heartbeatMatchmaking, ticket?.status]);

  async function startAiGame() {
    setBusy(true);
    setError(undefined);
    try {
      const gameId = await createAiGame({ difficulty: Number(difficulty) });
      router.push(`/game/${gameId}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create the game.");
    } finally { setBusy(false); }
  }

  async function findMatch() {
    setBusy(true);
    setError(undefined);
    try {
      const result = await joinMatchmaking({ timeControl });
      if (result.gameId) router.push(`/game/${result.gameId}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not join matchmaking.");
    } finally { setBusy(false); }
  }

  const waiting = ticket?.status === "waiting";
  const chosen = difficulties.find((item) => item.level === Number(difficulty)) ?? difficulties[1];

  return (
    <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_320px]">
      <Tabs defaultValue="computer" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="computer"><Bot /> Computer</TabsTrigger>
          <TabsTrigger value="online"><Users /> Online</TabsTrigger>
        </TabsList>
        <TabsContent value="computer" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Play Stockfish</CardTitle><CardDescription>Five tuned levels, from first principles to full-strength calculation.</CardDescription></CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-5">
                {difficulties.map((item) => (
                  <button
                    className={`rounded-xl border p-4 text-left transition ${difficulty === String(item.level) ? "border-emerald-400 bg-emerald-400/10" : "border-border bg-muted/20 hover:bg-muted/40"}`}
                    key={item.level}
                    onClick={() => setDifficulty(String(item.level))}
                    type="button"
                  >
                    <span className="text-xs text-muted-foreground">Level {item.level}</span>
                    <span className="mt-2 block font-medium">{item.name}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{item.elo}</span>
                  </button>
                ))}
              </div>
              <div className="mt-6 flex flex-col justify-between gap-4 rounded-xl border bg-muted/20 p-4 sm:flex-row sm:items-center">
                <div><p className="font-medium">{chosen.name}</p><p className="text-sm text-muted-foreground">{chosen.detail}</p></div>
                <Button disabled={busy || !profile} onClick={startAiGame}>{busy ? <LoaderCircle className="animate-spin" /> : <Swords />} Start game</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="online" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Find a live opponent</CardTitle><CardDescription>Convex keeps the queue and board synchronized in realtime.</CardDescription></CardHeader>
            <CardContent className="space-y-6">
              <div className="max-w-xs">
                <label className="mb-2 block text-sm font-medium" htmlFor="time-control">Time control</label>
                <Select disabled={waiting} onValueChange={(value) => setTimeControl(value as typeof timeControl)} value={timeControl}>
                  <SelectTrigger id="time-control"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="rapid">Rapid · 10 min</SelectItem><SelectItem value="blitz">Blitz · 5 min</SelectItem><SelectItem value="bullet">Bullet · 1 min</SelectItem></SelectContent>
                </Select>
              </div>
              {waiting ? (
                <div className="flex flex-col items-center rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-6 py-10 text-center">
                  <Radio className="size-8 animate-pulse text-emerald-400" />
                  <p className="mt-4 font-medium">Searching for a worthy opponent…</p>
                  <p className="mt-1 text-sm text-muted-foreground">Keep this page open. Your game starts automatically.</p>
                  <Button className="mt-5" onClick={() => void cancelMatchmaking()} variant="outline">Cancel search</Button>
                </div>
              ) : <Button disabled={busy || !profile} onClick={findMatch}>{busy ? <LoaderCircle className="animate-spin" /> : <Radio />} Find match</Button>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <Card className="h-fit">
        <CardHeader><div className="flex items-center justify-between"><CardTitle className="text-base">Your profile</CardTitle><Badge variant="secondary">Live</Badge></div></CardHeader>
        <CardContent>
          {profile ? <><p className="text-3xl font-semibold tabular-nums">{profile.rating}</p><p className="text-sm text-muted-foreground">rating</p><div className="mt-6 grid grid-cols-3 gap-2 text-center text-sm"><div><p className="font-medium">{profile.wins}</p><p className="text-xs text-muted-foreground">Wins</p></div><div><p className="font-medium">{profile.draws}</p><p className="text-xs text-muted-foreground">Draws</p></div><div><p className="font-medium">{profile.losses}</p><p className="text-xs text-muted-foreground">Losses</p></div></div></> : <div className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Preparing your profile</div>}
          <div className="mt-6 flex items-start gap-3 rounded-xl bg-amber-500/10 p-3 text-sm"><Crown className="mt-0.5 size-4 shrink-0 text-amber-400" /><p className="text-muted-foreground">The Pro tutor is available in computer games, where it can show and explain the strongest move.</p></div>
          {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
