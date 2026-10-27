"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { ChevronRight, ClipboardCheck, Crown, Laptop, LogOut, Moon, Sun, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useMobileMenu } from "@/components/shared/mobile-nav";
import { navGroupsFor, type NavItem } from "@/components/shared/nav-items";
import { useMe } from "@/hooks/use-current-user";
import { useNavCounts } from "@/hooks/use-nav-counts";
import { useLogout } from "@/hooks/use-logout";
import { cn } from "@/utils/cn";

function initials(name?: string) {
  return (
    (name ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "R"
  );
}

function findActiveHref(pathname: string, items: NavItem[]): string | null {
  const exact = items.find((item) => pathname === item.href);
  if (exact) return exact.href;
  const matches = items.filter((item) => pathname.startsWith(`${item.href}/`));
  if (matches.length === 0) return null;
  return matches.reduce((best, item) => (item.href.length > best.href.length ? item : best)).href;
}

const THEMES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "Auto", icon: Laptop },
] as const;

/**
 * The phone-sized side menu: a left sheet with the reviewer's profile, every page of the portal (including
 * the Default Reviewer ones), an appearance switch and sign-out. Opened from the tab bar's Menu tab.
 */
export function MobileMenuSheet() {
  const { menuOpen, setMenuOpen } = useMobileMenu();
  const pathname = usePathname();
  const { me, isDefault } = useMe();
  const counts = useNavCounts();
  const { theme, setTheme } = useTheme();
  const { logout, isPending } = useLogout();
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Any navigation (including the browser back button) closes the menu.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname, setMenuOpen]);

  const groups = navGroupsFor(isDefault);
  const activeHref = findActiveHref(pathname, groups.flatMap((g) => g.items));

  return (
    <>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="w-[88%] max-w-[22rem] gap-0 overflow-y-auto border-r-0 bg-background p-0 sm:max-w-[22rem]"
        >
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SheetDescription className="sr-only">Navigate the reviewer portal, change appearance, or sign out.</SheetDescription>

          <div className="relative shrink-0 overflow-hidden bg-linear-to-br from-[#0b1b28] via-[#112636] to-[#1e3a5f] px-5 pt-safe pb-6 text-white">
            <div aria-hidden="true" className="pointer-events-none absolute -top-16 -right-14 size-56 rounded-full bg-brand-gold/25 blur-3xl" />
            <div className="relative flex items-center justify-between pt-3">
              <span className="text-[10px] font-semibold tracking-[0.22em] text-brand-gold uppercase">Club at Ibis</span>
              <SheetClose
                aria-label="Close menu"
                className="flex size-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20 active:scale-90"
              >
                <X className="size-4.5" aria-hidden="true" />
              </SheetClose>
            </div>
            <div className="relative mt-4 flex items-center gap-4">
              <Avatar className="size-16 ring-2 ring-brand-gold/70 ring-offset-2 ring-offset-[#112636]">
                <AvatarFallback className="bg-linear-to-br from-brand-gold to-[#8a7339] font-heading text-xl font-semibold text-white">
                  {initials(me?.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate font-heading text-xl leading-tight font-medium">{me?.name || "Reviewer"}</p>
                <p className="mt-0.5 truncate text-xs text-slate-300">{me?.email}</p>
                <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider text-slate-100 uppercase backdrop-blur">
                  {isDefault ? <Crown className="size-3" aria-hidden="true" /> : <ClipboardCheck className="size-3" aria-hidden="true" />}
                  {isDefault ? "Default Reviewer" : "ARB Reviewer"}
                </span>
              </div>
            </div>
          </div>

          <nav aria-label="Menu" className="flex-1 space-y-4 px-4 pt-5">
            {groups.map((group) => (
              <div key={group.label} className="space-y-1.5">
                <p className="px-2 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">{group.label}</p>
                <ul className="space-y-1">
                  {group.items.map((item) => {
                    const isActive = item.href === activeHref;
                    const Icon = item.icon;
                    const badge = item.badge ? counts[item.badge] : 0;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() => setMenuOpen(false)}
                          aria-current={isActive ? "page" : undefined}
                          className={cn(
                            "group relative flex min-h-12 items-center gap-3 rounded-xl px-2.5 py-2 outline-none transition-all active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-primary/40",
                            isActive ? "bg-primary/8 dark:bg-brand-gold/10" : "hover:bg-muted/60"
                          )}
                        >
                          {isActive && <span aria-hidden="true" className="absolute top-1/2 left-0 h-6 w-1 -translate-y-1/2 rounded-r-full bg-brand-gold" />}
                          <span
                            className={cn(
                              "flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors",
                              isActive ? "bg-primary text-primary-foreground shadow-xs" : "bg-muted text-muted-foreground group-hover:text-foreground"
                            )}
                          >
                            <Icon className="size-[18px]" aria-hidden="true" />
                          </span>
                          <span className={cn("flex-1 text-sm", isActive ? "font-semibold text-foreground" : "font-medium text-foreground/85")}>{item.label}</span>
                          {badge > 0 && (
                            <span
                              className={cn(
                                "flex min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] leading-5 font-bold",
                                item.badge === "notifications" ? "bg-rose-500 text-white" : "bg-brand-gold text-[#0d1522]"
                              )}
                            >
                              {badge > 99 ? "99+" : badge}
                            </span>
                          )}
                          <ChevronRight className="size-4 text-muted-foreground/50" aria-hidden="true" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}

            <div className="space-y-1.5">
              <p className="px-2 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">Appearance</p>
              <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
                {THEMES.map(({ value, label, icon: Icon }) => {
                  const selected = mounted && theme === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setTheme(value)}
                      className={cn(
                        "flex min-h-10 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold outline-none transition-all active:scale-95 focus-visible:ring-2 focus-visible:ring-primary/40",
                        selected ? "bg-card text-foreground shadow-xs" : "text-muted-foreground"
                      )}
                    >
                      <Icon className="size-3.5" aria-hidden="true" />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </nav>

          <div className="mt-5 space-y-3 px-4 pb-4 pb-safe">
            <button
              type="button"
              onClick={() => setConfirmingLogout(true)}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 py-3 text-sm font-semibold text-rose-700 outline-none transition-all active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-rose-400/50 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300"
            >
              <LogOut className="size-4" aria-hidden="true" />
              Log out
            </button>
            <p className="text-center text-[10px] tracking-wide text-muted-foreground">Architectural Review Board · Reviewer Portal</p>
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirmingLogout}
        onOpenChange={(open) => {
          if (!isPending) setConfirmingLogout(open);
        }}
        title="Log out?"
        description="You'll need to sign in again to access the reviewer portal."
        confirmLabel={isPending ? "Logging out..." : "Log Out"}
        loading={isPending}
        destructive
        onConfirm={async () => {
          await logout();
        }}
      />
    </>
  );
}
