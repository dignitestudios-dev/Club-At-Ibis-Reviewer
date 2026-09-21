"use client";

import { BadgeCheck, CalendarDays, ClipboardCheck, Clock, Crown, Hash, Info, Mail, Briefcase } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe } from "@/hooks/use-current-user";
import { useRequests } from "@/hooks/use-reviewer-data";
import { IN_FLIGHT } from "@/lib/domain";
import { formatDate, formatDateTime } from "@/utils/format";

function Detail({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        <Icon className="size-3.5" />
        {label}
      </dt>
      <dd className="text-sm break-words text-foreground">{children}</dd>
    </div>
  );
}

/** Read-only: the Super Admin configures these details. */
export default function ProfilePage() {
  const { me, isDefault } = useMe();
  const { data: requests } = useRequests();

  if (!me) return <Skeleton className="h-64 w-full rounded-2xl" />;
  const mine = (requests ?? []).filter((r) => r.assignedReviewerId === me.id);
  const active = mine.filter((r) => IN_FLIGHT.includes(r.status)).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader title="My Profile" description="Your reviewer account as configured by the Super Admin." />

      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-5 shadow-2xs sm:p-6">
        <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-brand-gold to-amber-600" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <PersonAvatar name={me.name} className="size-16" fallbackClassName="text-xl" />
            <div className="space-y-1.5">
              <h2 className="font-heading text-2xl font-medium text-foreground">{me.name}</h2>
              <p className="text-sm text-muted-foreground">{me.designation}</p>
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-gold/15 px-2.5 py-0.5 text-[11px] font-bold tracking-wider text-brand-gold uppercase">
                {isDefault ? <Crown className="size-3" aria-hidden="true" /> : <ClipboardCheck className="size-3" aria-hidden="true" />}
                {isDefault ? "Default Reviewer" : "ARB Reviewer"}
              </span>
            </div>
          </div>
          <dl className="flex gap-6 text-center sm:text-right">
            <div>
              <dd className="font-heading text-2xl font-semibold tabular-nums">{active}</dd>
              <dt className="text-[11px] text-muted-foreground">In progress</dt>
            </div>
            <div>
              <dd className="font-heading text-2xl font-semibold tabular-nums">{mine.length}</dd>
              <dt className="text-[11px] text-muted-foreground">Assigned overall</dt>
            </div>
          </dl>
        </div>
      </div>

      <Card className="shadow-2xs">
        <CardHeader className="border-b border-border/70 pb-3">
          <CardTitle className="font-heading text-lg font-medium">Account details</CardTitle>
        </CardHeader>
        <CardContent className="pt-5">
          <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
            <Detail icon={BadgeCheck} label="Name">{me.name}</Detail>
            <Detail icon={Hash} label="Employee number"><span className="font-mono">{me.employeeNumber}</span></Detail>
            <Detail icon={Briefcase} label="Designation">{me.designation}</Detail>
            <Detail icon={Mail} label="Email">{me.email}</Detail>
            <Detail icon={CalendarDays} label="Member since">{formatDate(me.createdAt)}</Detail>
            <Detail icon={Clock} label="Last sign-in">{me.lastLoginAt ? formatDateTime(me.lastLoginAt) : "—"}</Detail>
          </dl>
        </CardContent>
      </Card>

      <div className="flex items-start gap-3 rounded-2xl border border-border/80 bg-muted/30 p-4 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <p className="text-muted-foreground">
          {isDefault
            ? "You are a Default Reviewer: new requests arrive in your Incoming list, where you can take ownership or assign them, and you can track and reassign requests in Request Oversight."
            : "Requests are assigned to you by a Default Reviewer. You'll be notified when a new request arrives."}{" "}
          To change your name, employee number, designation or email, contact the Super Admin.
        </p>
      </div>
    </div>
  );
}
