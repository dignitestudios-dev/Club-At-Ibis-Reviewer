"use client";

import { useState } from "react";
import { Crown, Inbox, RefreshCw, UserRoundPlus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { SearchInput } from "@/components/shared/search-input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { AssignReviewerDialog } from "@/features/requests/components/assign-reviewer-dialog";
import { RequestsTable } from "@/features/requests/components/requests-table";
import { useAssignRequest, useIncomingRequestsPage, useResidents } from "@/hooks/use-reviewer-data";
import { useMe } from "@/hooks/use-current-user";
import { usePageSize } from "@/hooks/use-page-size";
import { useToast } from "@/hooks/use-toast";
import { useUrlParams, useUrlSearch } from "@/hooks/use-url-params";
import { cn } from "@/utils/cn";

export function DefaultReviewersOnly() {
  return (
    <EmptyState
      icon={Crown}
      title="Available to default reviewers"
      description="Incoming requests and request oversight are only shown to reviewers who receive new requests. The Super Admin manages who that is."
    />
  );
}

export default function IncomingPage() {
  const toast = useToast();
  const { me, isDefault } = useMe();
  const { values, set } = useUrlParams({ page: "1" });
  const [search, setSearch] = useUrlSearch("q");
  const [pageSize, setPageSize] = usePageSize();
  const [target, setTarget] = useState<RequestRecord | null>(null);
  const [taking, setTaking] = useState<string | null>(null);
  const take = useAssignRequest();

  const page = Math.max(1, Number(values.page) || 1);
  const { data: pageData, isLoading, isFetching, refetch } = useIncomingRequestsPage(
    {
      search: search.trim() || undefined,
      page,
      limit: pageSize,
    },
    { enabled: isDefault }
  );

  if (me && !isDefault) return <DefaultReviewersOnly />;

  const rows = pageData?.requests ?? [];
  const total = pageData?.pagination?.total ?? 0;
  const q = search.trim();

  function takeOwnership(req: RequestRecord) {
    if (!me) return;
    setTaking(req.id);
    take.mutate(
      { requestId: req.id, reviewerId: me.id },
      {
        onSuccess: () => toast.success("Ownership taken", `${req.code} is now in My Assigned Requests.`),
        onError: (e: Error) => toast.error("Could not take ownership", e.message),
        onSettled: () => setTaking(null),
      }
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Incoming Requests"
        description="New submissions arrive here first. Take ownership yourself, or assign the request to another active reviewer."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await refetch();
                  toast.success("Incoming requests refreshed");
                } catch {
                  toast.error("Failed to refresh incoming requests");
                }
              }}
              disabled={isFetching}
              className="h-8 gap-1.5"
              aria-label="Refresh incoming requests"
              title="Refresh incoming requests"
            >
              <RefreshCw className={cn("size-3.5", isFetching && "animate-spin")} />
              <span>Refresh</span>
            </Button>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-gold/40 bg-brand-gold/10 px-3 py-1 text-xs font-semibold text-amber-800 dark:text-amber-200">
              <Inbox className="size-3.5" aria-hidden="true" />
              {total} waiting
            </span>
          </div>
        }
      />

      <SearchInput value={search} onChange={setSearch} placeholder="Search reference, resident, property or lot…" className="sm:max-w-sm" />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={q ? "No incoming requests match" : "Incoming is empty"}
          description={q ? "Try a different search." : "Every submitted request has an owner. New submissions will appear here until someone takes them."}
        />
      ) : (
        <div className="space-y-4">
          <RequestsTable
            rows={rows}
            renderActions={(req) => (
              <div className="flex items-center justify-end gap-2">
                <Button size="sm" onClick={() => takeOwnership(req)} disabled={taking === req.id}>
                  {taking === req.id && <Spinner className="size-4" />}
                  Take ownership
                </Button>
                <Button size="sm" variant="outline" onClick={() => setTarget(req)}>
                  <UserRoundPlus />
                  Assign
                </Button>
              </div>
            )}
          />
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={(p) => set({ page: String(p) })}
            onPageSizeChange={(n) => {
              setPageSize(n);
              set({ page: "1" });
            }}
          />
        </div>
      )}

      <AssignReviewerDialog request={target} onOpenChange={(o) => !o && setTarget(null)} />
    </div>
  );
}
