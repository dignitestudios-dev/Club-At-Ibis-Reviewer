"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";
import { CommandPalette } from "@/components/shared/command-palette";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { UserMenu } from "@/components/shared/user-menu";

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
    <header className="sticky top-0 z-30 flex min-h-14 items-center gap-3 border-b border-border bg-card px-4 pt-safe lg:px-6 transition-colors duration-200">
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
        <ThemeToggle />
        <NotificationBell />
        <div className="max-lg:hidden">
          <UserMenu />
        </div>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </header>
  );
}
