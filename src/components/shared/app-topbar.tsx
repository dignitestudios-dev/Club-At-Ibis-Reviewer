"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useMobileMenu } from "@/components/shared/mobile-nav";
import { useMe } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";
import { CommandPalette } from "@/components/shared/command-palette";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { UserMenu } from "@/components/shared/user-menu";

/** Phone / tablet header action: the avatar opens the side menu (the desktop dropdown is hidden there). */
function MobileAvatarButton() {
  const { me } = useMe();
  const { setMenuOpen } = useMobileMenu();
  const initials =
    (me?.name ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "R";

  return (
    <button
      type="button"
      onClick={() => setMenuOpen(true)}
      aria-label="Open menu"
      aria-haspopup="dialog"
      className="flex size-10 items-center justify-center rounded-full outline-none transition-transform active:scale-90 focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <Avatar className="size-8 ring-2 ring-brand-gold/50 ring-offset-2 ring-offset-card">
        <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">{initials}</AvatarFallback>
      </Avatar>
    </button>
  );
}

export function AppTopbar() {
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex min-h-14 items-center gap-3 border-b border-border bg-card px-4 pt-safe transition-colors duration-200 max-lg:bg-card/85 max-lg:backdrop-blur-xl lg:px-6">
      <div className="lg:hidden">
        <Logo variant="navy" size={30} titleClassName="whitespace-nowrap text-lg" />
      </div>

      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        className="hidden h-9 w-full max-w-md items-center gap-2.5 rounded-lg border border-border bg-muted/40 px-3 text-left text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-muted/70 md:flex"
        aria-label="Open search (Ctrl+K)"
      >
        <Search className="size-4" aria-hidden="true" />
        <span className="flex-1 truncate">Search your requests by reference, resident or property…</span>
        <kbd className="rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-medium">Ctrl K</kbd>
      </button>

      <div className="ml-auto flex items-center gap-1.5">
        <Button variant="ghost" size="icon" className="size-10 md:hidden" onClick={() => setPaletteOpen(true)} aria-label="Search">
          <Search className="size-4.5" />
        </Button>
        <div className="max-lg:hidden">
          <ThemeToggle />
        </div>
        <NotificationBell />
        <div className="max-lg:hidden">
          <UserMenu />
        </div>
        <div className="lg:hidden">
          <MobileAvatarButton />
        </div>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </header>
  );
}
