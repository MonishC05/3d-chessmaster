import { PlayerProfileSync } from "@/components/player-profile-sync";
import type { ReactNode } from "react";

export default function PlayLayout({ children }: { children: ReactNode }) {
  return <><PlayerProfileSync />{children}</>;
}
