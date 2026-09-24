"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ChevronRight, FileDiff, LayoutTemplate, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { SearchInput } from "@/components/shared/search-input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCategories, useRequests } from "@/hooks/use-reviewer-data";
import { useMe } from "@/hooks/use-current-user";
import { useToast } from "@/hooks/use-toast";
import { useUrlSearch } from "@/hooks/use-url-params";
import { formatRelative } from "@/utils/format";
import { cn } from "@/utils/cn";

/** Every form the board uses, with what changed in its latest version. */
export default function FormsPage() {
  const toast = useToast();
  const { me, isDefault } = useMe();
  const { data: categories, isLoading, isFetching, refetch } = useCategories();
  const { data: requests } = useRequests();
  const [search, setSearch] = useUrlSearch("q");

  const q = search.trim().toLowerCase();
  const list = useMemo(
    () =>
      [...(categories ?? [])]
        .filter((c) => c.status === "active")
        .filter((c) => !q || `${c.name} ${c.description}`.toLowerCase().includes(q))
        // Recently updated forms first.
        .sort((a, b) => (b.version > 1 ? 1 : 0) - (a.version > 1 ? 1 : 0) || (a.updatedAt < b.updatedAt ? 1 : -1)),
    [categories, q]
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Form Updates"
        description="When the Super Admin edits a category form, a new version is created. Compare what a form was with what it is now."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                await refetch();
                toast.success("Forms refreshed");
              } catch {
                toast.error("Failed to refresh forms");
              }
            }}
            disabled={isFetching}
            className="h-8 gap-1.5"
            aria-label="Refresh forms"
            title="Refresh forms"
          >
            <RefreshCw className={cn("size-3.5", isFetching && "animate-spin")} />
            <span>Refresh</span>
          </Button>
        }
      />
      <SearchInput value={search} onChange={setSearch} placeholder="Search forms…" className="sm:max-w-sm" />

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState icon={LayoutTemplate} title="No forms found" description="Try a different search." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((cat) => {
            const updated = cat.version > 1;
            const latest = cat.versions[cat.versions.length - 1];
            const onOlder = (requests ?? []).filter((r) => r.categoryId === cat.id && r.formVersion < cat.version && (isDefault || r.assignedReviewerId === me?.id)).length;
            const href = updated ? `/forms/${cat.id}?from=${cat.version - 1}&to=${cat.version}` : `/forms/${cat.id}`;
            return (
              <Link
                key={cat.id}
                href={href}
                className={cn(
                  "group flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-2xs transition-all hover:-translate-y-0.5 hover:shadow-md",
                  updated ? "border-teal-300/60 dark:border-teal-800/60" : "border-border/80"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-heading text-lg leading-snug font-medium text-foreground">{cat.name}</h2>
                  <span className="rounded-full bg-muted px-2.5 py-1 font-mono text-[11px] text-muted-foreground">v{cat.version}</span>
                </div>
                {updated ? (
                  <div className="space-y-1.5">
                    <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800 dark:text-teal-300">
                      <FileDiff className="size-3.5" aria-hidden="true" />
                      Updated {formatRelative(latest.createdAt)} · v{cat.version - 1} → v{cat.version}
                    </p>
                    <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                      {latest.changes.slice(0, 3).map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Original version — no changes yet.</p>
                )}
                <div className="mt-auto flex items-center justify-between border-t border-border/70 pt-3 text-xs text-muted-foreground">
                  <span>{onOlder > 0 ? `${onOlder} request${onOlder === 1 ? "" : "s"} on an older version` : "All requests on the latest version"}</span>
                  <span className="inline-flex items-center gap-1 font-medium text-primary dark:text-amber-300">
                    {updated ? "Compare" : "View"}
                    <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
