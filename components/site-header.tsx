"use client";

import { Show, UserButton } from "@clerk/nextjs";
import { Crown, Menu } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const links = [{ href: "/play", label: "Play" }, { href: "/pricing", label: "Pro tutor" }];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid size-8 place-items-center rounded-lg bg-emerald-400 text-zinc-950"><Crown className="size-4" /></span>
          3D ChessMaster
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          {links.map((link) => <Link className="transition hover:text-foreground" href={link.href} key={link.href}>{link.label}</Link>)}
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          <Show when="signed-out">
            <Button asChild variant="ghost"><Link href="/sign-in">Sign in</Link></Button>
            <Button asChild><Link href="/sign-up">Get started</Link></Button>
          </Show>
          <Show when="signed-in"><UserButton /></Show>
        </div>
        <Sheet>
          <SheetTrigger asChild><Button className="md:hidden" size="icon" variant="ghost"><Menu /><span className="sr-only">Open navigation</span></Button></SheetTrigger>
          <SheetContent>
            <SheetHeader><SheetTitle>3D ChessMaster</SheetTitle></SheetHeader>
            <nav className="mt-8 flex flex-col gap-5 px-4">
              {links.map((link) => <Link href={link.href} key={link.href}>{link.label}</Link>)}
              <Show when="signed-out"><Button asChild><Link href="/sign-in">Sign in</Link></Button></Show>
              <Show when="signed-in"><div className="flex items-center gap-3"><UserButton showName /></div></Show>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
