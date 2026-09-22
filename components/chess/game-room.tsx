"use client";

import { Chess } from "chess.js";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Bot, CircleAlert, LoaderCircle, Radio, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { requestStockfishMove, type EngineMove } from "@/lib/chess/stockfish";
import { ThreeBoard } from "@/components/chess/three-board";
import { TutorPanel } from "@/components/chess/tutor-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

type MoveRecord = { _id: string; from: string; to: string; san: string; uci: string; ply: number };

export function GameRoom({ gameId }: { gameId: Id<"games"> }) {
  const data = useQuery(api.chess.getGame, { gameId });
  const submitMove = useMutation(api.chess.submitMove);
  const acknowledgeMatch = useMutation(api.chess.acknowledgeMatch);
  const [selected, setSelected] = useState<string>();
  const [hint, setHint] = useState<{ fen: string; move: EngineMove }>();
  const [engineBusy, setEngineBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [engineRetry, setEngineRetry] = useState(0);
  const engineFenRef = useRef<string | undefined>(undefined);
  const latestFenRef = useRef<string | undefined>(undefined);
  const moves = (data?.moves ?? []) as MoveRecord[];
  const game = data?.game;
  const lastMove = moves.at(-1);
  const chess = useMemo(() => game ? new Chess(game.currentFen) : null, [game]);

  useEffect(() => {
    void acknowledgeMatch({ gameId });
  }, [acknowledgeMatch, gameId]);

  useEffect(() => {
    latestFenRef.current = game?.currentFen;
  }, [game?.currentFen]);

  useEffect(() => {
    if (!game || game.mode !== "ai" || game.status !== "active" || game.turn !== "b") return;
    if (engineFenRef.current === game.currentFen) return;
    const fen = game.currentFen;
    engineFenRef.current = fen;
    setEngineBusy(true);
    setError(undefined);
    void requestStockfishMove(fen, game.difficulty ?? 2)
      .then((reply) => submitMove({ gameId, from: reply.from, to: reply.to, promotion: reply.promotion, asAi: true }))
      .catch((caught: unknown) => {
        engineFenRef.current = undefined;
        setError(caught instanceof Error ? caught.message : "The engine could not move.");
      })
      .finally(() => setEngineBusy(false));
  }, [engineRetry, game, gameId, submitMove]);

  if (!data || !game || !chess) return <div className="grid min-h-[70vh] place-items-center"><LoaderCircle className="size-7 animate-spin text-emerald-400" /></div>;

  const currentGame = game;
  const position = chess;

  const isMyTurn = currentGame.mode === "ai" ? currentGame.turn === "w" : currentGame.turn === data.myColor;

  async function onSquareClick(square: string) {
    if (!isMyTurn || currentGame.status !== "active" || engineBusy) return;
    if (!selected) {
      const piece = position.get(square as never);
      if (piece && piece.color === currentGame.turn) setSelected(square);
      return;
    }
    if (selected === square) { setSelected(undefined); return; }
    const candidate = position.moves({ square: selected as never, verbose: true }).find((move) => move.to === square);
    if (!candidate) {
      const piece = position.get(square as never);
      setSelected(piece?.color === currentGame.turn ? square : undefined);
      return;
    }
    setSelected(undefined); setHint(undefined); setError(undefined);
    try {
      await submitMove({ gameId, from: selected, to: square, promotion: candidate.promotion ?? "q" });
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The move could not be played."); }
  }

  async function requestHint() {
    if (currentGame.status !== "active" || currentGame.turn !== "w" || engineBusy) throw new Error("Hints are available on your turn.");
    const requestedFen = currentGame.currentFen;
    const move = await requestStockfishMove(requestedFen, 5);
    if (latestFenRef.current !== requestedFen) throw new Error("The position changed while the hint was calculating.");
    setHint({ fen: requestedFen, move });
    return move;
  }

  return (
    <section className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <Button asChild size="sm" variant="ghost"><Link href="/play"><ArrowLeft /> Back to lobby</Link></Button>
        <div className="flex items-center gap-2 text-sm">
          {game.mode === "ai" ? <Bot className="size-4 text-emerald-400" /> : <Radio className="size-4 text-emerald-400" />}
          <span>{game.mode === "ai" ? `Stockfish · Level ${game.difficulty}` : `${game.timeControl} match`}</span>
          <Badge variant={game.status === "active" ? "default" : "secondary"}>{game.status}</Badge>
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(560px,1fr)_340px_360px]">
        <div>
          <div className="mb-3 flex items-center justify-between rounded-xl border bg-card px-4 py-3">
            <div><p className="text-sm font-medium">{game.mode === "ai" ? "Stockfish" : data.players.find((seat: { color: string }) => seat.color !== data.myColor)?.player?.displayName ?? "Opponent"}</p><p className="text-xs text-muted-foreground">{game.turn === data.myColor ? "Waiting" : "Thinking"}</p></div>
            {engineBusy ? <span className="flex items-center gap-2 text-xs text-emerald-400"><LoaderCircle className="size-3 animate-spin" /> Engine calculating</span> : null}
          </div>
          <ThreeBoard fen={game.currentFen} hintMove={hint?.fen === game.currentFen ? hint.move : undefined} lastMove={lastMove} onSquareClick={onSquareClick} orientation={data.myColor} selected={selected} />
          <div className="mt-3 flex items-center justify-between rounded-xl border bg-card px-4 py-3">
            <div><p className="text-sm font-medium">You · {data.myColor === "w" ? "White" : "Black"}</p><p className="text-xs text-muted-foreground">{isMyTurn ? "Your turn" : "Opponent's turn"}</p></div>
            {game.status === "completed" ? <Badge variant="outline">{game.result} · {game.endReason}</Badge> : null}
          </div>
          {error ? <div aria-live="polite" className="mt-3 flex items-center justify-between gap-3 text-sm text-destructive"><p className="flex items-center gap-2"><CircleAlert className="size-4" />{error}</p>{currentGame.mode === "ai" && currentGame.turn === "b" ? <Button onClick={() => { engineFenRef.current = undefined; setError(undefined); setEngineRetry((value) => value + 1); }} size="sm" variant="outline">Retry engine</Button> : null}</div> : null}
        </div>
        <Card className="overflow-hidden py-0">
          <div className="flex items-center justify-between border-b p-4"><p className="font-medium">Move history</p><RotateCcw className="size-4 text-muted-foreground" /></div>
          <ScrollArea className="h-[520px] p-4">
            {moves.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">Make the first move.</p> : <div className="grid grid-cols-[42px_1fr_1fr] gap-y-2 text-sm">{Array.from({ length: Math.ceil(moves.length / 2) }, (_, index) => <div className="contents" key={index}><span className="text-muted-foreground">{index + 1}.</span><span>{moves[index * 2]?.san}</span><span>{moves[index * 2 + 1]?.san}</span></div>)}</div>}
          </ScrollArea>
        </Card>
        <Card className="overflow-hidden py-0"><TutorPanel fen={game.currentFen} gameId={gameId} gameMode={game.mode} lastMove={lastMove?.san} onRequestHint={requestHint} /></Card>
      </div>
    </section>
  );
}
