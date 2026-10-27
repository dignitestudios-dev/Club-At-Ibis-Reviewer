"use client";

import { createContext, useContext, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, FileDiff, House, Inbox, ListChecks, User } from "lucide-react";
import { useMe } from "@/hooks/use-current-user";
import { useNavCounts } from "@/hooks/use-nav-counts";
import { cn } from "@/utils/cn";

interface MobileNavContextValue {
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
}

const MobileNavContext = createContext<MobileNavContextValue | null>(null);

export function MobileNavProvider({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const value = useMemo(() => ({ menuOpen, setMenuOpen }), [menuOpen]);
  return <MobileNavContext.Provider value={value}>{children}</MobileNavContext.Provider>;
}

export function useMobileMenu() {
  const ctx = useContext(MobileNavContext);
  if (!ctx) throw new Error("useMobileMenu must be used inside <MobileNavProvider>");
  return ctx;
}

function tap() {
  // Light haptic tick where the platform supports it (Android Chrome); a silent no-op elsewhere.
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(8);
}

const tabClass =
  "group flex h-full w-full flex-col items-center justify-center gap-0.5 rounded-xl outline-none transition-transform duration-150 active:scale-90 focus-visible:ring-2 focus-visible:ring-primary/40";

function TabIcon({ active, badge, children }: { active: boolean; badge?: number; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "relative flex h-7 w-14 items-center justify-center rounded-full transition-all duration-200",
        active ? "bg-primary/10 text-primary dark:bg-brand-gold/15 dark:text-brand-gold" : "text-muted-foreground group-hover:text-foreground"
      )}
    >
      {children}
      {!!badge && badge > 0 && (
        <span className="absolute top-0 right-3 flex min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] leading-4 font-bold text-white shadow-xs ring-2 ring-card">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </span>
  );
}

function TabLabel({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <span className={cn("text-[10px] leading-none font-semibold tracking-wide transition-colors", active ? "text-primary dark:text-brand-gold" : "text-muted-foreground")}>
      {children}
    </span>
  );
}

/**
 * Phone / tablet tab bar (hidden at lg+ where the sidebar takes over): Home, the reviewer's work lists,
 * Alerts and Profile. The full navigation lives in the side menu, opened from the avatar in the header.
 */
export function MobileBottomNav() {
  const pathname = usePathname();
  const { isDefault } = useMe();
  const counts = useNavCounts();

  const is = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  // Open request pages belong to the work lists, so highlight "Assigned" (or "Incoming" for a Default Reviewer's intake).
  const home = is("/dashboard");
  const assigned = is("/my-requests") || is("/requests");
  const middleIsIncoming = isDefault;
  const middle = middleIsIncoming ? is("/incoming") : is("/forms");
  const alerts = is("/notifications");
  const profile = is("/profile");

  const MiddleIcon = middleIsIncoming ? Inbox : FileDiff;

  return (
    <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40 lg:hidden">
      <div className="border-t border-border/70 bg-card/92 pb-safe shadow-[0_-10px_30px_-14px_rgba(15,23,42,0.25)] backdrop-blur-xl supports-[backdrop-filter]:bg-card/80">
        <ul className="mx-auto grid h-16 max-w-lg grid-cols-5 items-stretch px-2">
          <li>
            <Link href="/dashboard" onClick={tap} aria-current={home ? "page" : undefined} className={tabClass}>
              <TabIcon active={home}>
                <House className="size-[22px]" strokeWidth={home ? 2.4 : 2} aria-hidden="true" />
              </TabIcon>
              <TabLabel active={home}>Home</TabLabel>
            </Link>
          </li>
          <li>
            <Link
              href="/my-requests"
              onClick={tap}
              aria-current={assigned ? "page" : undefined}
              aria-label={counts.mine > 0 ? `Assigned (${counts.mine} active)` : "Assigned"}
              className={tabClass}
            >
              <TabIcon active={assigned} badge={counts.mine}>
                <ListChecks className="size-[22px]" strokeWidth={assigned ? 2.4 : 2} aria-hidden="true" />
              </TabIcon>
              <TabLabel active={assigned}>Assigned</TabLabel>
            </Link>
          </li>
          <li>
            <Link
              href={middleIsIncoming ? "/incoming" : "/forms"}
              onClick={tap}
              aria-current={middle ? "page" : undefined}
              aria-label={middleIsIncoming && counts.incoming > 0 ? `Incoming (${counts.incoming} waiting)` : middleIsIncoming ? "Incoming" : "Forms"}
              className={tabClass}
            >
              <TabIcon active={middle} badge={middleIsIncoming ? counts.incoming : 0}>
                <MiddleIcon className="size-[22px]" strokeWidth={middle ? 2.4 : 2} aria-hidden="true" />
              </TabIcon>
              <TabLabel active={middle}>{middleIsIncoming ? "Incoming" : "Forms"}</TabLabel>
            </Link>
          </li>
          <li>
            <Link
              href="/notifications"
              onClick={tap}
              aria-current={alerts ? "page" : undefined}
              aria-label={counts.notifications > 0 ? `Alerts (${counts.notifications} unread)` : "Alerts"}
              className={tabClass}
            >
              <TabIcon active={alerts} badge={counts.notifications}>
                <Bell className="size-[22px]" strokeWidth={alerts ? 2.4 : 2} aria-hidden="true" />
              </TabIcon>
              <TabLabel active={alerts}>Alerts</TabLabel>
            </Link>
          </li>
          <li>
            <Link href="/profile" onClick={tap} aria-current={profile ? "page" : undefined} className={tabClass}>
              <TabIcon active={profile}>
                <User className="size-[22px]" strokeWidth={profile ? 2.4 : 2} aria-hidden="true" />
              </TabIcon>
              <TabLabel active={profile}>Profile</TabLabel>
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
}
