"use client";

import { ProcessingChip } from "@/components/shared/processing-chip";
import Link from "next/link";
import { format } from "date-fns";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  Hourglass,
  Inbox,
  ListChecks,
  PlayCircle,
  Repeat2,
  Search,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { InView } from "@/components/shared/in-view";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { NotificationIcon } from "@/features/notifications/components/notification-icon";
import { DonutChart } from "@/features/dashboard/components/charts";
import { useReviewerDashboard } from "@/features/dashboard/api/dashboard.queries";
import { useMe } from "@/hooks/use-current-user";
import { STATUS_COLOR, STATUS_LABEL, STATUS_ORDER } from "@/lib/domain";
import { formatRelative } from "@/utils/format";
import { cn } from "@/utils/cn";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

interface AttentionItem {
  key: string;
  label: string;
  count: number;
  icon: LucideIcon;
  hint: string;
  href: string;
  bar: string;
  tile: string;
}

export default function DashboardOverview() {
  // The session's own Default-Reviewer flag is the single source of truth
  // used everywhere else (sidebar, /incoming, /oversight) — reading it here
  // too (rather than the dashboard payload's `capabilities.sharedIntake`)
  // keeps this page in sync with them and avoids a general-reviewer flash
  // of the shared-intake copy while the dashboard request is still loading.
  const { me, isDefault } = useMe();
  const { data, isLoading } = useReviewerDashboard();

  const attentionData = data?.attention;
  const workload = data?.workload;
  const statusCounts = data?.statusCounts ?? {};
  const upNext = data?.upNext ?? [];
  const notifications = data?.notifications.recent ?? [];
  const unreadCount = data?.notifications.unreadCount ?? 0;

  const attention: AttentionItem[] = [
    ...(isDefault
      ? [
          {
            key: "incoming",
            label: "Incoming requests",
            count: attentionData?.incoming ?? 0,
            icon: Inbox,
            hint: "Waiting for someone to take ownership or assign them",
            href: "/incoming",
            bar: "bg-sky-500",
            tile: "bg-sky-50 text-sky-700 border-sky-200/80 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800",
          },
        ]
      : []),
    {
      key: "start",
      label: "Ready to start review",
      count: attentionData?.readyToStart ?? 0,
      icon: PlayCircle,
      hint: "Assigned to you. Open the request to begin your review.",
      href: "/my-requests?status=assigned",
      bar: "bg-slate-500",
      tile: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    },
    {
      key: "resubmitted",
      label: "Resubmitted by residents",
      count: attentionData?.resubmitted ?? 0,
      icon: Repeat2,
      hint: "Corrected items are ready for you to review again",
      href: "/my-requests?status=resubmitted",
      bar: "bg-purple-500",
      tile: "bg-purple-50 text-purple-700 border-purple-200/80 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800",
    },
    {
      key: "approved",
      label: "Approved: Finish completion",
      count: attentionData?.approvedForCompletion ?? 0,
      icon: FileCheck2,
      hint: "Deposit, final letter or completion still outstanding",
      href: "/my-requests?status=approved",
      bar: "bg-emerald-500",
      tile: "bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800",
    },
    {
      key: "refunds",
      label: "Refund actions",
      count: attentionData?.refundActions ?? 0,
      icon: Undo2,
      hint: "Withdrawn with a received deposit. Record or complete the refund.",
      href: "/my-requests?tab=history&status=withdrawn",
      bar: "bg-amber-500",
      tile: "bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800",
    },
  ];
  const attentionTotal = attentionData?.total ?? attention.reduce((s, x) => s + x.count, 0);
  const firstName = me?.name.split(" ")[0] ?? "reviewer";

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between animate-in fade-in slide-in-from-top-3 duration-500">
        <div className="space-y-1">
          <p className="text-xs font-semibold tracking-wider text-brand-gold uppercase">{format(new Date(), "EEEE, MMMM d")}</p>
          <h1 className="font-heading text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
            {greeting()}, {firstName}
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {isDefault
              ? "Your queue, plus the incoming requests waiting for an owner."
              : "The requests assigned to you and what each one needs next."}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {isDefault && (
            <Button variant="outline" nativeButton={false} render={<Link href="/incoming" />}>
              <Inbox className="size-4" />
              Incoming ({attentionData?.incoming ?? 0})
            </Button>
          )}
          <Button nativeButton={false} render={<Link href="/my-requests" />} className="shadow-xs">
            <ListChecks className="size-4" />
            My Assigned Requests
          </Button>
        </div>
      </div>

      {/* Needs attention */}
      <section aria-labelledby="attention-heading" className="space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-500 delay-75 fill-mode-both">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="attention-heading" className="font-heading text-xl font-medium text-foreground">
              Needs Your Attention
            </h2>
            <p className="text-xs text-muted-foreground">Work that is waiting on you right now.</p>
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
              attentionTotal > 0
                ? "border-amber-300/80 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                : "border-emerald-300/80 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
            )}
          >
            {attentionTotal > 0 ? <AlertTriangle className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
            {attentionTotal > 0 ? `${attentionTotal} open item${attentionTotal === 1 ? "" : "s"}` : "All clear"}
          </span>
        </div>

        <Card className="overflow-hidden shadow-2xs">
          <ul className="divide-y divide-border/70">
            {attention.map((item, i) => {
              const Icon = item.icon;
              const clear = !isLoading && item.count === 0;
              return (
                <li key={item.key} style={{ animationDelay: `${i * 60}ms` }} className="animate-in fade-in slide-in-from-bottom-1 fill-mode-both">
                  <Link
                    href={item.href}
                    className="group relative flex items-center gap-4 px-4 py-4 outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 sm:px-5"
                  >
                    <span aria-hidden="true" className={cn("absolute inset-y-2 left-0 w-1 rounded-r-full", clear ? "bg-transparent" : item.bar)} />
                    <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl border transition-transform duration-200 group-hover:scale-105", clear ? "border-border bg-muted text-muted-foreground" : item.tile)}>
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-foreground">{item.label}</span>
                      <span className="block text-xs text-muted-foreground">{clear ? "Nothing waiting" : item.hint}</span>
                    </span>
                    <span
                      className={cn(
                        "flex h-9 min-w-9 items-center justify-center rounded-full px-3 font-heading text-lg font-semibold tabular-nums",
                        clear ? "bg-muted text-muted-foreground" : "bg-foreground/5 text-foreground"
                      )}
                    >
                      {isLoading ? "–" : item.count}
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      </section>

      {/* My numbers */}
      <section aria-label="My workload" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)
        ) : (
          <>
            <StatCard label="Open Requests" value={workload?.openRequests ?? 0} icon={ListChecks} accent="navy" href="/my-requests" hint="Assigned to me" />
            <StatCard label="Under Review" value={workload?.underReview ?? 0} icon={Search} accent="blue" href="/my-requests?status=under_review" hint="Currently under review" />
            <StatCard label="Waiting on Residents" value={workload?.waitingOnResidents ?? 0} icon={Hourglass} accent="amber" href="/my-requests?status=changes_required" hint="Changes required" />
            <StatCard label="Completed" value={workload?.completed ?? 0} icon={ClipboardCheck} accent="emerald" href="/my-requests?tab=history&status=completed" hint="Finished by me" />
          </>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-5">
        {/* Up next */}
        <Card className="shadow-2xs lg:col-span-3">
          <CardHeader className="border-b border-border/70 pb-3">
            <CardTitle className="font-heading text-lg font-medium">Up Next</CardTitle>
            <p className="text-xs text-muted-foreground">Requests that need an action from you, longest-waiting first.</p>
            <CardAction>
              <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/my-requests" />}>
                All Requests
                <ArrowRight className="size-3.5" />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="pt-3">
            {!isLoading && upNext.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Nothing needs your action. New assignments will appear here.</p>
            ) : (
              <ul className="divide-y divide-border/70">
                {upNext.map((req) => (
                  <li key={req.id}>
                    <Link href={`/requests/${req.id}`} className="group flex items-center gap-3 py-3 outline-none hover:bg-muted/40 focus-visible:bg-muted/40">
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-primary dark:text-amber-300">{req.reference}</span>
                          <StatusBadge status={req.status} />
                          <ProcessingChip request={req} />
                        </span>
                        <span className="block truncate text-sm text-foreground">
                          {req.categoryName} · {req.residentName}
                        </span>
                        <span className="block text-xs text-muted-foreground">updated {formatRelative(req.updatedAt)}</span>
                      </span>
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Status mix */}
        <Card className="shadow-2xs lg:col-span-2">
          <CardHeader className="border-b border-border/70 pb-3">
            <CardTitle className="font-heading text-lg font-medium">My Requests by Status</CardTitle>
            <p className="text-xs text-muted-foreground">{workload?.totalAssigned ?? 0} assigned overall</p>
          </CardHeader>
          <CardContent className="pt-5">
            <InView fallback={<Skeleton className="mx-auto size-48 rounded-full" />}>
              <div className="flex flex-col items-center gap-5 sm:flex-row lg:flex-col xl:flex-row">
                <DonutChart
                  centerLabel="Requests"
                  centerValue={workload?.totalAssigned ?? 0}
                  segments={STATUS_ORDER.map((s) => ({ key: s, label: STATUS_LABEL[s], value: statusCounts[s] ?? 0, color: STATUS_COLOR[s] }))}
                />
                <ul className="grid w-full grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-1">
                  {STATUS_ORDER.map((s) => (
                    <li key={s} className="flex items-center gap-2 text-xs">
                      <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: STATUS_COLOR[s] }} />
                      <span className="flex-1 truncate text-muted-foreground">{STATUS_LABEL[s]}</span>
                      <span className="font-semibold tabular-nums text-foreground">{statusCounts[s] ?? 0}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </InView>
          </CardContent>
        </Card>
      </div>

      {/* Notifications */}
      <section>
        <Card className="shadow-2xs">
          <CardHeader className="border-b border-border/70 pb-3">
            <CardTitle className="font-heading text-lg font-medium">Recent Notifications</CardTitle>
            <p className="text-xs text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} unread` : "You're up to date"}
            </p>
            <CardAction>
              <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/notifications" />}>
                <Bell className="size-3.5" />
                All Notifications
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="pt-2">
            {!isLoading && notifications.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No notifications yet.</p>
            ) : (
              <ul className="divide-y divide-border/70">
                {notifications.map((n) => {
                  const content = (
                    <>
                      <NotificationIcon type={n.type} />
                      <div className="min-w-0 flex-1">
                        <p className={cn("text-sm text-foreground", !n.read && "font-semibold")}>{n.title}</p>
                        <p className="line-clamp-1 text-xs text-muted-foreground">{n.message}</p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatRelative(n.createdAt)}</span>
                    </>
                  );
                  return (
                    <li key={n.id}>
                      {n.requestId ? (
                        <Link href={`/requests/${n.requestId}`} className="flex items-start gap-3 py-3 outline-none transition-colors hover:bg-muted/40 focus-visible:bg-muted/40">
                          {content}
                        </Link>
                      ) : (
                        <div className="flex items-start gap-3 py-3">{content}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
