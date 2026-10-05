"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, FileDiff, FileText, FilePlus2, GitCommitVertical, Minus, Pencil, Plus, RotateCcw, Tag } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { RequiredMark } from "@/components/shared/required-mark";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FIELD_TYPE_BY_ID, describeAccept, isChoiceType } from "@/features/forms/components/field-types";
import type { CategoryVersionDetail, VersionActor } from "@/features/forms/api/forms.service";
import { useCategoryVersions, useRequests, useResidents } from "@/hooks/use-reviewer-data";
import { useMe } from "@/hooks/use-current-user";
import { useUrlParams } from "@/hooks/use-url-params";
import { fieldDiffStates } from "@/lib/category-diff";
import { residentFullName } from "@/lib/domain";
import { formatDateTime, formatRelative } from "@/utils/format";
import { cn } from "@/utils/cn";

function changeTone(text: string) {
  if (text.startsWith("Added")) return { icon: Plus, cls: "bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800" };
  if (text.startsWith("Removed")) return { icon: Minus, cls: "bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800" };
  if (text.startsWith("Restored")) return { icon: RotateCcw, cls: "bg-sky-50 text-sky-700 border-sky-200/80 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800" };
  if (text === "Initial form") return { icon: FilePlus2, cls: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700" };
  return { icon: Pencil, cls: "bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800" };
}

function getActorName(actor?: VersionActor | null): string {
  return actor?.displayName || "Super Admin";
}

/**
 * Same version-history layout as the admin side's "Version history" page
 * (list of every version on the left, selected version + diff highlighting
 * on the right) — a reviewer can look but not touch: no restore, no editing.
 */
export default function FormComparePage({ id }: { id: string }) {
  const { me, isDefault } = useMe();
  const { data: versionData, isLoading } = useCategoryVersions(id);
  const { data: requests } = useRequests();
  const { data: residents } = useResidents();
  const { values, set } = useUrlParams({ v: "" });

  const category = versionData?.category;
  const versions = useMemo(() => [...(versionData?.versions ?? [])].sort((a, b) => b.version - a.version), [versionData]);
  const counts = useMemo(() => {
    const map = new Map<number, number>();
    (requests ?? []).filter((r) => r.categoryId === id).forEach((r) => map.set(r.formVersion, (map.get(r.formVersion) ?? 0) + 1));
    return map;
  }, [requests, id]);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <Skeleton className="h-4 w-36 rounded" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-28 rounded" />
            <Skeleton className="h-8 w-60 rounded" />
            <Skeleton className="h-4 w-48 rounded" />
          </div>
        </div>
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <div>
            <Card className="shadow-2xs">
              <CardHeader className="border-b border-border/70 pb-3">
                <Skeleton className="h-5 w-24 rounded" />
              </CardHeader>
              <CardContent className="space-y-2 pt-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-xl" />
                ))}
              </CardContent>
            </Card>
          </div>
          <div className="min-w-0 space-y-5">
            <Card className="shadow-2xs">
              <CardHeader className="border-b border-border/70 pb-3">
                <Skeleton className="h-5 w-32 rounded" />
              </CardHeader>
              <CardContent className="space-y-4 pt-5">
                <Skeleton className="h-12 w-full rounded-xl" />
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-xl" />
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

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

  const currentVersionNumber = category.currentVersion;
  const selectedNumber = Number(values.v) || currentVersionNumber;
  const selected: CategoryVersionDetail =
    versions.find((v) => v.version === selectedNumber) ?? versions[0];
  const previous = versions.find((v) => v.version === selected.version - 1);
  const isCurrent = selected.version === currentVersionNumber;
  const diff = fieldDiffStates(previous?.fields, selected.fields);
  const removed = previous ? previous.fields.filter((f) => !selected.fields.some((x) => x.id === f.id)) : [];

  const changeList: string[] =
    selected.changeSummaries.length > 0
      ? selected.changeSummaries
      : selected.changes.length > 0
      ? selected.changes
      : ["Initial form"];

  const visibleRequests = (requests ?? []).filter((r) => r.categoryId === id && (isDefault || r.assignedReviewerId === me?.id));
  const outdated = visibleRequests.filter((r) => r.formVersion < currentVersionNumber);
  const residentById = new Map((residents ?? []).map((r) => [r.id, r]));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Link href="/forms" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Form updates
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-wider text-brand-gold uppercase">Version history</p>
          <h1 className="font-heading text-2xl font-medium text-foreground sm:text-3xl">{category.name}</h1>
          <p className="text-sm text-muted-foreground">
            {versions.length} version{versions.length === 1 ? "" : "s"} · current is <span className="font-semibold text-foreground">v{currentVersionNumber}</span>
          </p>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        {/* Version list */}
        <Card className="gap-0 overflow-hidden py-0 shadow-2xs lg:sticky lg:top-20 lg:max-h-[calc(100svh-6.5rem)]">
          <CardHeader className="shrink-0 border-b border-border/70 py-4">
            <CardTitle className="font-heading text-lg font-medium">All versions</CardTitle>
            <p className="text-xs text-muted-foreground">Every saved edit creates a new version. Earlier versions are never changed.</p>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-0 custom-scrollbar">
            <ol className="max-h-80 divide-y divide-border/60 overflow-y-auto custom-scrollbar lg:max-h-none lg:overflow-visible">
              {versions.map((v) => {
                const active = v.version === selected.version;
                const used = counts.get(v.version) ?? 0;
                const firstChange = v.changeSummaries[0] || v.changes[0] || `v${v.version}`;
                const extraChangesCount = (v.changeSummaries.length || v.changes.length || 1) - 1;
                const author = getActorName(v.createdBy);
                return (
                  <li key={v.version}>
                    <button
                      type="button"
                      onClick={() => set({ v: String(v.version) })}
                      aria-current={active ? "true" : undefined}
                      className={cn(
                        "relative flex w-full items-start gap-3 px-5 py-4 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/50",
                        active && "bg-primary/5 dark:bg-amber-400/5"
                      )}
                    >
                      {active && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-primary dark:bg-amber-400" />}
                      <span className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border font-mono text-xs font-bold", v.version === currentVersionNumber ? "border-primary bg-primary text-primary-foreground dark:border-amber-400 dark:bg-amber-400 dark:text-[#0d1522]" : "border-border bg-muted text-muted-foreground")}>
                        v{v.version}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">{v.version === 1 ? "Initial version" : `Version ${v.version}`}</span>
                          {v.version === currentVersionNumber && (
                            <span className="rounded-full bg-emerald-50 px-2 py-px text-[10px] font-bold tracking-wider text-emerald-800 uppercase dark:bg-emerald-950/50 dark:text-emerald-300">Current</span>
                          )}
                        </span>
                        <span className="block break-words text-xs text-muted-foreground" title={formatDateTime(v.createdAt)}>
                          {formatRelative(v.createdAt)} · {author}
                        </span>
                        <span className="mt-1 line-clamp-2 block break-words text-xs text-foreground/80">{firstChange}{extraChangesCount > 0 ? ` +${extraChangesCount} more` : ""}</span>
                        <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <FileText className="size-3" aria-hidden="true" />
                          {used} request{used === 1 ? "" : "s"} submitted on this version
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>

        {/* Selected version */}
        <div className="min-w-0 space-y-5">
          <Card className="shadow-2xs">
            <CardHeader className="border-b border-border/70 pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="font-heading text-lg font-medium">
                    Version {selected.version} {isCurrent && <span className="ml-1 text-sm font-normal text-emerald-700 dark:text-emerald-300">· current</span>}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Saved {formatDateTime(selected.createdAt)} by {getActorName(selected.createdBy)}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 pt-5">
              {selected.note && (
                <p className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 px-3.5 py-2.5 text-sm text-foreground">
                  <Tag className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  {selected.note}
                </p>
              )}

              <div>
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  <GitCommitVertical className="size-3.5" aria-hidden="true" />
                  {previous ? `Changes from v${previous.version}` : "What this version contains"}
                </p>
                <ul className="space-y-1.5">
                  {changeList.map((c, i) => {
                    const tone = changeTone(c);
                    const CI = tone.icon;
                    return (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-foreground">
                        <span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border", tone.cls)}>
                          <CI className="size-3" aria-hidden="true" />
                        </span>
                        {c}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-2xs">
            <CardHeader className="border-b border-border/70 pb-3">
              <CardTitle className="font-heading text-lg font-medium">Form as residents saw it</CardTitle>
              <p className="text-xs text-muted-foreground">
                The {selected.fields.length} configured field{selected.fields.length === 1 ? "" : "s"} for this version.
              </p>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              {selected.fields.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No fields in this version.</p>}
              <ol className="space-y-2.5">
                {selected.fields.map((f, i) => {
                  const meta = FIELD_TYPE_BY_ID.get(f.type)!;
                  const TI = meta.icon;
                  const state = diff.get(f.id);
                  return (
                    <li
                      key={f.id || i}
                      className={cn(
                        "flex gap-3 rounded-xl border bg-card p-3.5",
                        state === "added" ? "border-emerald-300/80 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/20" : state === "changed" ? "border-amber-300/80 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/20" : "border-border"
                      )}
                    >
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-bold tabular-nums text-muted-foreground">{i + 1}</span>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{f.label}</span>
                          {f.required && <RequiredMark />}
                          <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary dark:text-amber-300">
                            <TI className="size-3" aria-hidden="true" />
                            {meta.label}
                          </span>
                          {state === "added" && <span className="rounded-full bg-emerald-100 px-2 py-px text-[10px] font-bold tracking-wider text-emerald-800 uppercase dark:bg-emerald-950 dark:text-emerald-300">New</span>}
                          {state === "changed" && <span className="rounded-full bg-amber-100 px-2 py-px text-[10px] font-bold tracking-wider text-amber-900 uppercase dark:bg-amber-950 dark:text-amber-300">Changed</span>}
                        </div>
                        {f.helpText && <p className="text-xs break-all text-muted-foreground">{f.helpText}</p>}
                        {isChoiceType(f.type) && <p className="text-xs text-muted-foreground">Options: {(f.options ?? []).join(" · ")}</p>}
                        {f.type === "file" && (
                          <p className="text-xs text-muted-foreground">
                            {describeAccept(f.accept)}
                            {f.multiple ? " · multiple files" : ""}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>

              {removed.length > 0 && (
                <div className="rounded-xl border border-rose-300/70 bg-rose-50/60 p-3.5 dark:border-rose-900/70 dark:bg-rose-950/20">
                  <p className="mb-1.5 text-[11px] font-semibold tracking-wider text-rose-800 uppercase dark:text-rose-300">Removed since v{previous?.version}</p>
                  <ul className="space-y-1 text-sm text-foreground/80">
                    {removed.map((f) => (
                      <li key={f.id} className="line-through decoration-rose-400/70">
                        {f.label}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Reviewer-specific: which of your requests used which version */}
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
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", r.formVersion < currentVersionNumber ? "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300" : "bg-muted text-muted-foreground")}>
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
