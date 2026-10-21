"use client";

import { useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";

export function PlayerProfileSync() {
  const { user, isLoaded } = useUser();
  const ensurePlayer = useMutation(api.chess.ensurePlayer);

  useEffect(() => {
    if (!isLoaded || !user) return;
    void ensurePlayer({
      displayName: user.fullName ?? user.username ?? user.primaryEmailAddress?.emailAddress.split("@")[0] ?? "Chess player",
      imageUrl: user.imageUrl,
    });
  }, [ensurePlayer, isLoaded, user]);
  return null;
}
