"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, FileDiff, FileText, Minus, Pencil, Plus } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterSelect } from "@/components/shared/filter-select";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FIELD_TYPE_BY_ID, describeAccept } from "@/features/forms/components/field-types";
import { useCategories, useRequests, useResidents } from "@/hooks/use-reviewer-data";
import { useMe } from "@/hooks/use-current-user";
import { useUrlParams } from "@/hooks/use-url-params";
import { describeChanges, fieldDiffStates } from "@/lib/category-diff";
import { residentFullName } from "@/lib/domain";
import { formatDateTime } from "@/utils/format";
import { cn } from "@/utils/cn";

function changeTone(text: string) {
  if (text.startsWith("Added")) return { icon: Plus, cls: "bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800" };
  if (text.startsWith("Removed")) return { icon: Minus, cls: "bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800" };
  return { icon: Pencil, cls: "bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800" };
}

/** The properties of a field that a reviewer cares about, as short labelled chips. */
function fieldBits(f: CategoryField): { key: string; text: string }[] {
  const bits = [
    { key: "type", text: FIELD_TYPE_BY_ID.get(f.type)?.label ?? f.type },
    { key: "required", text: f.required ? "Required" : "Optional" },
  ];
  if (f.helpText) bits.push({ key: "help", text: `Help: ${f.helpText}` });
  if (f.options?.length) bits.push({ key: "options", text: `Options: ${f.options.join(", ")}` });
  if (f.type === "file") {
    bits.push({ key: "accept", text: `Accepts ${describeAccept(f.accept)}` });
    bits.push({ key: "multiple", text: f.multiple ? "Multiple files" : "Single file" });
  }
  return bits;
}

const STATE_BADGE = {
  added: { label: "Added", cls: "border-emerald-300/80 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" },
  removed: { label: "Removed", cls: "border-rose-300/80 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300" },
  changed: { label: "Changed", cls: "border-amber-300/80 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300" },
  same: { label: "Unchanged", cls: "border-border bg-muted/50 text-muted-foreground" },
} as const;

function Chips({ bits, other, dim }: { bits: { key: string; text: string }[]; other?: { key: string; text: string }[]; dim?: boolean }) {
  const otherMap = new Map((other ?? []).map((b) => [b.key, b.text]));
  return (
    <div className="flex flex-wrap gap-1.5">
      {bits.map((b) => {
        const differs = other && otherMap.get(b.key) !== b.text;
        return (
          <span
            key={b.key}
            className={cn(
              "rounded-md border px-1.5 py-0.5 text-[11px]",
              differs ? "border-amber-300 bg-amber-100 font-semibold text-amber-950 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200" : "border-border bg-muted/40 text-muted-foreground",
              dim && "opacity-60"
            )}
          >
            {b.text}
          </span>
        );
      })}
    </div>
  );
}

export default function FormComparePage({ id }: { id: string }) {
  const { me, isDefault } = useMe();
  const { data: categories, isLoading } = useCategories();
  const { data: requests } = useRequests();
  const { data: residents } = useResidents();
  const { values, set } = useUrlParams({ from: "", to: "" });

  const category = categories?.find((c) => c.id === id);
  const versions = useMemo(() => [...(category?.versions ?? [])].sort((a, b) => a.version - b.version), [category]);

  if (isLoading) return <Skeleton className="h-96 w-full rounded-2xl" />;
  if (!category || versions.length === 0) {
    return (
      <EmptyState
        icon={FileDiff}
        title="Form not found"
        action={
          <Button nativeButton={false} render={<Link href="/forms" />}>
            Back to form updates
          </Button>
        }
      />
    );
  }

  const latest = versions[versions.length - 1].version;
  const toNumber = versions.some((v) => v.version === Number(values.to)) ? Number(values.to) : latest;
  const fromDefault = Math.max(versions[0].version, toNumber - 1);
  const fromNumber = versions.some((v) => v.version === Number(values.from)) ? Number(values.from) : fromDefault;
  const from = versions.find((v) => v.version === fromNumber)!;
  const to = versions.find((v) => v.version === toNumber)!;
  const same = from.version === to.version;

  const changes = same ? [] : describeChanges(from, to);
  const states = fieldDiffStates(from.fields, to.fields);
  const fromById = new Map(from.fields.map((f) => [f.id, f]));
  const removed = from.fields.filter((f) => !to.fields.some((x) => x.id === f.id));
  const rows = [
    ...[...to.fields].sort((a, b) => a.order - b.order).map((f) => ({ field: f, was: fromById.get(f.id), state: states.get(f.id) ?? "same" })),
    ...removed.map((f) => ({ field: f, was: f, state: "removed" as const })),
  ];
  // Differences first, unchanged fields last.
  const priority = { added: 0, changed: 1, removed: 2, same: 3 } as const;
  rows.sort((x, y) => priority[x.state] - priority[y.state]);
  const counts = { added: 0, removed: 0, changed: 0 };
  rows.forEach((r) => {
    if (r.state !== "same") counts[r.state] += 1;
  });

  const visibleRequests = (requests ?? []).filter((r) => r.categoryId === id && (isDefault || r.assignedReviewerId === me?.id));
  const outdated = visibleRequests.filter((r) => r.formVersion < latest);
  const residentById = new Map((residents ?? []).map((r) => [r.id, r]));
  const options = versions.map((v) => ({ label: `v${v.version}${v.version === latest ? " (latest)" : ""}`, value: String(v.version) }));

  // Notes for every version between `from` (exclusive) and `to` (inclusive).
  const between = versions.filter((v) => v.version > from.version && v.version <= to.version);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Link href="/forms" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Form updates
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-wider text-brand-gold uppercase">Form comparison</p>
          <h1 className="font-heading text-2xl font-medium text-foreground sm:text-3xl">{category.name}</h1>
          <p className="text-sm text-muted-foreground">
            The form is on <span className="font-semibold text-foreground">v{latest}</span> · {versions.length} version{versions.length === 1 ? "" : "s"}. Requests keep the form they were submitted on.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <FilterSelect label="Was" value={String(from.version)} onChange={(v) => set({ from: v })} options={options} className="w-36" />
          <ArrowRight className="mb-2.5 size-4 text-muted-foreground" aria-hidden="true" />
          <FilterSelect label="Now" value={String(to.version)} onChange={(v) => set({ to: v })} options={options} className="w-36" />
        </div>
      </div>

      {same ? (
        <EmptyState icon={FileDiff} title="Pick two different versions" description="Choose an earlier version under “Was” and a later one under “Now” to compare them." />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: "Fields added", n: counts.added, cls: "text-emerald-700 dark:text-emerald-300" },
              { label: "Fields changed", n: counts.changed, cls: "text-amber-700 dark:text-amber-300" },
              { label: "Fields removed", n: counts.removed, cls: "text-rose-700 dark:text-rose-300" },
            ].map((c) => (
              <div key={c.label} className="rounded-2xl border border-border/80 bg-card p-4 shadow-2xs">
                <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{c.label}</p>
                <p className={cn("font-heading text-3xl font-semibold tabular-nums", c.cls)}>{c.n}</p>
              </div>
            ))}
          </div>

          <Card className="shadow-2xs">
            <CardHeader className="border-b border-border/70 pb-3">
              <CardTitle className="font-heading text-lg font-medium">
                What changed · v{from.version} → v{to.version}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {between.map((v) => `v${v.version} by ${v.createdBy}, ${formatDateTime(v.createdAt)}`).join(" · ")}
              </p>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              {changes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No differences between these two versions.</p>
              ) : (
                <ul className="space-y-2">
                  {changes.map((text) => {
                    const tone = changeTone(text);
                    const Icon = tone.icon;
                    return (
                      <li key={text} className={cn("flex items-start gap-2.5 rounded-lg border px-3 py-2 text-sm", tone.cls)}>
                        <Icon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                        {text}
                      </li>
                    );
                  })}
                </ul>
              )}
              {between.filter((v) => v.note).map((v) => (
                <p key={v.version} className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">Note on v{v.version}:</span> {v.note}
                </p>
              ))}
            </CardContent>
          </Card>

          <Card className="shadow-2xs">
            <CardHeader className="border-b border-border/70 pb-3">
              <CardTitle className="font-heading text-lg font-medium">Field by Field</CardTitle>
              <p className="text-xs text-muted-foreground">Highlighted properties are the ones that differ.</p>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="hidden grid-cols-[7rem_minmax(0,1fr)_minmax(0,1fr)] gap-4 border-b border-border/70 px-1 py-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase md:grid">
                <span>Status</span>
                <span>Was · v{from.version}</span>
                <span>Now · v{to.version}</span>
              </div>
              <ul className="divide-y divide-border/70">
                {rows.map(({ field, was, state }) => {
                  const badge = STATE_BADGE[state];
                  const wasBits = was ? fieldBits(was) : [];
                  const nowBits = state === "removed" ? [] : fieldBits(field);
                  return (
                    <li key={field.id} className={cn("grid gap-3 px-1 py-3.5 md:grid-cols-[7rem_minmax(0,1fr)_minmax(0,1fr)] md:gap-4", state === "same" && "opacity-70")}>
                      <div>
                        <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase", badge.cls)}>{badge.label}</span>
                      </div>
                      <div className="min-w-0 space-y-1.5">
                        <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase md:hidden">Was · v{from.version}</p>
                        {was ? (
                          <>
                            <p className={cn("text-sm font-medium text-foreground", was.label !== field.label && "line-through decoration-muted-foreground/60")}>{was.label}</p>
                            <Chips bits={wasBits} other={state === "changed" ? nowBits : undefined} dim={state === "removed"} />
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">Did not exist</p>
                        )}
                      </div>
                      <div className="min-w-0 space-y-1.5">
                        <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase md:hidden">Now · v{to.version}</p>
                        {state === "removed" ? (
                          <p className="text-xs text-muted-foreground italic">Removed from the form</p>
                        ) : (
                          <>
                            <p className="text-sm font-medium text-foreground">{field.label}</p>
                            <Chips bits={nowBits} other={state === "changed" ? wasBits : undefined} />
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </>
      )}

      <Card className="shadow-2xs">
        <CardHeader className="border-b border-border/70 pb-3">
          <CardTitle className="font-heading text-lg font-medium">Requests on This Form</CardTitle>
          <p className="text-xs text-muted-foreground">
            {isDefault ? "All requests" : "Your requests"} for {category.name}: {visibleRequests.length} total, {outdated.length} submitted on an older version (they keep their original form).
          </p>
        </CardHeader>
        <CardContent className="pt-2">
          {visibleRequests.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No requests on this form yet.</p>
          ) : (
            <ul className="divide-y divide-border/70">
              {[...visibleRequests]
                .sort((a, b) => a.formVersion - b.formVersion)
                .slice(0, 8)
                .map((r) => (
                  <li key={r.id}>
                    <Link href={`/requests/${r.id}`} className="group flex items-center gap-3 py-3 hover:bg-muted/40">
                      <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="font-mono text-xs font-semibold text-primary dark:text-amber-300">{r.code}</span>
                        <span className="block truncate text-sm text-foreground">{residentFullName(residentById.get(r.residentId))}</span>
                      </span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", r.formVersion < latest ? "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300" : "bg-muted text-muted-foreground")}>
                        Submitted on v{r.formVersion}
                      </span>
                      <StatusBadge status={r.status} />
                    </Link>
                  </li>
                ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
