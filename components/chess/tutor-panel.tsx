"use client";

import { useAuth } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { useEveAgent } from "eve/react";
import {
  GraduationCap,
  LoaderCircle,
  LockKeyhole,
  MessageCircle,
  Send,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { EngineMove } from "@/lib/chess/stockfish";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

type Props = {
  gameId: Id<"games">;
  fen: string;
  gameMode: "ai" | "online";
  lastMove?: string;
  onRequestHint: () => Promise<EngineMove>;
};

type ConversationProps = Props & {
  isPro: boolean;
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function TutorPanel(props: Props) {
  const { has, isLoaded } = useAuth();

  if (props.gameMode === "online") {
    return (
      <div className="grid min-h-80 place-items-center p-8 text-center">
        <div>
          <LockKeyhole className="mx-auto size-7 text-muted-foreground" />
          <p className="mt-4 font-medium">Tutor paused for fair play</p>
          <p className="mt-2 text-sm text-muted-foreground">
            AI assistance is disabled during live games.
          </p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  const isPro = has?.({ feature: "ai_tutor" }) ?? false;
  const agentName = isPro ? "tutor" : "companion";

  return <TutorConversation {...props} isPro={isPro} key={agentName} />;
}

function TutorConversation({
  gameId,
  fen,
  gameMode,
  isPro,
  lastMove,
  onRequestHint,
}: ConversationProps) {
  const { getToken } = useAuth();
  const recordUsage = useMutation(api.chess.recordTutorUsage);
  const usageSessionId = useRef(crypto.randomUUID());
  const [input, setInput] = useState("");
  const [hintBusy, setHintBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [localError, setLocalError] = useState<string>();

  const tokenHeaders = useCallback(async (): Promise<Readonly<Record<string, string>>> => {
    const token = await getToken();
    return token ? { authorization: `Bearer ${token}` } : {};
  }, [getToken]);

  const agentName = isPro ? "tutor" : "companion";
  const agent = useEveAgent({
    agent: agentName,
    headers: tokenHeaders,
    onError(error) {
      setLocalError(errorMessage(error, "The chess assistant could not respond."));
    },
    onSessionChange(session) {
      if (session) usageSessionId.current = session.sessionId;
    },
  });

  const agentBusy =
    agent.status === "submitted" ||
    agent.status === "streaming" ||
    agent.status === "resuming";
  const busy = agentBusy || sending || hintBusy;
  const messages = useMemo(
    () =>
      agent.data.messages
        .map((message) => ({
          id: message.id,
          role: message.role,
          text: message.parts
            .filter((part) => part.type === "text")
            .map((part) => part.text)
            .join("\n"),
        }))
        .filter((message) => message.text),
    [agent.data.messages],
  );

  async function logUsage(kind: "chat" | "hint") {
    try {
      await recordUsage({
        gameId,
        eveSessionId: usageSessionId.current,
        kind,
      });
    } catch (error) {
      setLocalError(
        errorMessage(error, "The reply arrived, but its usage record could not be saved."),
      );
    }
  }

  async function send(text: string, kind: "chat" | "hint" = "chat", engineMove?: string) {
    const clean = text.trim();
    if (!clean || agentBusy || sending) return;

    setSending(true);
    setLocalError(undefined);
    try {
      await agent.prewarm();
      const message = isPro
        ? `Game context - mode: ${gameMode}; FEN: ${fen}; last move: ${lastMove ?? "none"}; Stockfish recommendation: ${engineMove ?? "not supplied"}. Player message: ${clean}`
        : clean;
      await agent.send(message);
      await logUsage(kind);
    } catch (error) {
      setLocalError(errorMessage(error, "The chess assistant could not send that message."));
    } finally {
      setSending(false);
    }
  }

  async function requestHint() {
    if (!isPro || gameMode !== "ai" || busy) return;

    setHintBusy(true);
    setLocalError(undefined);
    try {
      // The tutor prewarm is a server-side Clerk entitlement check. Do not
      // calculate or reveal the visual hint until that check succeeds.
      await agent.prewarm();
      const move = await onRequestHint();
      await send(
        "Show me why the recommended move is best and what idea I should learn from it.",
        "hint",
        move.uci,
      );
    } catch (error) {
      setLocalError(errorMessage(error, "The tutor could not prepare a hint."));
    } finally {
      setHintBusy(false);
    }
  }

  return (
    <div className="flex min-h-[430px] flex-col">
      <div className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-2">
          <GraduationCap className="size-5 text-emerald-400" />
          <span className="font-medium">{isPro ? "AI Tutor" : "Game companion"}</span>
        </div>
        <Badge variant={isPro ? "default" : "secondary"}>{isPro ? "Pro" : "Free"}</Badge>
      </div>

      {!isPro ? (
        <div className="border-b bg-amber-500/5 p-4 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <Sparkles className="size-4 text-amber-400" /> Unlock visual coaching
          </p>
          <p className="mt-1 text-muted-foreground">
            Your companion can chat, but it receives no board position. Pro adds best-move arrows and position-aware teaching.
          </p>
          <Button asChild className="mt-3" size="sm" variant="outline">
            <Link href="/pricing">View Pro plans</Link>
          </Button>
        </div>
      ) : (
        <div className="border-b p-3">
          <Button
            className="w-full"
            disabled={busy}
            onClick={() => void requestHint()}
            variant="outline"
          >
            {hintBusy ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
            Show and explain the best move
          </Button>
        </div>
      )}

      <ScrollArea className="min-h-0 flex-1 p-4">
        <div className="space-y-3">
          {messages.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <MessageCircle className="mx-auto mb-3 size-6" />
              {isPro
                ? "Ask about the position or request a guided hint."
                : "Talk with your game companion while you play."}
            </div>
          ) : null}
          {messages.map((message) => (
            <div
              className={`max-w-[88%] rounded-xl px-3 py-2 text-sm leading-6 ${
                message.role === "user" ? "ml-auto bg-emerald-500/15" : "bg-muted"
              }`}
              key={message.id}
            >
              {message.role === "user" && isPro
                ? message.text.replace(/^Game context[\s\S]*Player message: /, "")
                : message.text}
            </div>
          ))}
          {agentBusy || sending ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <LoaderCircle className="size-3 animate-spin" /> Thinking...
            </div>
          ) : null}
          {localError ?? agent.error?.message ? (
            <p className="text-sm text-destructive" role="alert">
              {localError ?? agent.error?.message}
            </p>
          ) : null}
        </div>
      </ScrollArea>

      <form
        className="flex gap-2 border-t p-3"
        onSubmit={(event) => {
          event.preventDefault();
          const message = input;
          setInput("");
          void send(message);
        }}
      >
        <Input
          aria-label="Message the chess assistant"
          disabled={busy}
          onChange={(event) => setInput(event.target.value)}
          placeholder={isPro ? "Ask why a move works..." : "Talk about the game..."}
          value={input}
        />
        <Button disabled={busy || !input.trim()} size="icon" type="submit">
          <Send />
          <span className="sr-only">Send</span>
        </Button>
      </form>
    </div>
  );
}
