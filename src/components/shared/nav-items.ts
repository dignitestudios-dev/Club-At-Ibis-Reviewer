import {
  Bell,
  Eye,
  FileDiff,
  Inbox,
  LayoutDashboard,
  ListChecks,
  UserRound,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Key of a live counter to show as a badge. */
  badge?: "mine" | "incoming" | "notifications";
  /** Only Default Reviewers (Receive New Requests) see this item. */
  defaultOnly?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    label: "My work",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/my-requests", label: "My Assigned Requests", icon: ListChecks, badge: "mine" },
      { href: "/forms", label: "Form Updates", icon: FileDiff },
    ],
  },
  {
    label: "Default reviewer",
    items: [
      { href: "/incoming", label: "Incoming Requests", icon: Inbox, badge: "incoming", defaultOnly: true },
      { href: "/oversight", label: "Request Oversight", icon: Eye, defaultOnly: true },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/notifications", label: "Notifications", icon: Bell, badge: "notifications" },
      { href: "/profile", label: "My Profile", icon: UserRound },
    ],
  },
];

export function navGroupsFor(isDefault: boolean): NavGroup[] {
  return navGroups
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.defaultOnly || isDefault) }))
    .filter((g) => g.items.length > 0);
}
