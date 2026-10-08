"use client";

import { useMemo } from "react";
import { Filter, History, ListChecks, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterCombobox } from "@/components/shared/filter-combobox";
import { FilterSelect } from "@/components/shared/filter-select";
import { Pagination } from "@/components/shared/pagination";
import { SegmentedTabs } from "@/components/shared/pill-tabs";
import { SearchInput } from "@/components/shared/search-input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TableFrame } from "@/components/shared/table-frame";
import { RequestsTable } from "@/features/requests/components/requests-table";
import { useCategories, useRequestsPage } from "@/hooks/use-reviewer-data";
import { useMe } from "@/hooks/use-current-user";
import { usePageSize } from "@/hooks/use-page-size";
import { useToast } from "@/hooks/use-toast";
import { useUrlParams, useUrlSearch } from "@/hooks/use-url-params";
import { IN_FLIGHT, STATUS_LABEL, STATUS_ORDER } from "@/lib/domain";
import { cn } from "@/utils/cn";

type Tab = "active" | "history";

const ACTIVE_STATUSES = "submitted,assigned,under_review,changes_required,resubmitted,approved";
const HISTORY_STATUSES = "completed,rejected,withdrawn";

export default function MyRequestsPage() {
  const toast = useToast();
  const { me, isDefault } = useMe();
  const { values, set } = useUrlParams({ tab: "active", status: "all", category: "all", page: "1" });
  const [search, setSearch] = useUrlSearch("q");
  const [pageSize, setPageSize] = usePageSize();
  const tab: Tab = values.tab === "history" ? "history" : "active";

  const page = Math.max(1, Number(values.page) || 1);
  const statusParam = values.status !== "all" ? values.status : tab === "active" ? ACTIVE_STATUSES : HISTORY_STATUSES;

  const { data: pageData, isLoading, isFetching, refetch } = useRequestsPage(
    {
      page,
      limit: pageSize,
      search: search.trim() || undefined,
      status: statusParam,
      categoryId: values.category !== "all" ? values.category : undefined,
      assignedReviewerId: isDefault ? me?.id : undefined,
    },
    { enabled: !me ? false : true }
  );

  // Tab badge counts come from the same paginated endpoint that powers the
  // table — `pagination.total` for each status bucket — not a separately
  // fetched, differently-capped "all mine" list that can drift from what's
  // actually shown once there are more requests than one page holds.
  const { data: activeTotalsPage } = useRequestsPage(
    { limit: 1, status: ACTIVE_STATUSES, assignedReviewerId: isDefault ? me?.id : undefined },
    { enabled: !me ? false : true }
  );
  const { data: historyTotalsPage } = useRequestsPage(
    { limit: 1, status: HISTORY_STATUSES, assignedReviewerId: isDefault ? me?.id : undefined },
    { enabled: !me ? false : true }
  );
  const { data: categories } = useCategories();

  const rows = pageData?.requests ?? [];
  const total = pageData?.pagination?.total ?? 0;
  const q = search.trim();
  const filtersOn = values.status !== "all" || values.category !== "all" || !!q;

  const activeCount = activeTotalsPage?.pagination?.total ?? 0;
  const historyCount = historyTotalsPage?.pagination?.total ?? 0;
  const totalMine = activeCount + historyCount;

  const categoryOptions = useMemo(
    () => [
      { label: "All categories", value: "all" },
      ...(categories ?? [])
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((c) => ({ label: c.name, value: c.id })),
    ],
    [categories]
  );

  const statusOptions = useMemo(
    () => [
      { label: "All statuses", value: "all" },
      ...(tab === "active" ? STATUS_ORDER.filter((s) => IN_FLIGHT.includes(s)) : STATUS_ORDER.filter((s) => !IN_FLIGHT.includes(s))).map((s) => ({
        label: STATUS_LABEL[s],
        value: s,
      })),
    ],
    [tab]
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="My Assigned Requests"
        description="Requests you own. Open one to review its information and documents, and to record your decision."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                await refetch();
                toast.success("Requests refreshed");
              } catch {
                toast.error("Failed to refresh requests");
              }
            }}
            disabled={isFetching}
            className="h-8 gap-1.5"
            aria-label="Refresh requests"
            title="Refresh requests"
          >
            <RefreshCw className={cn("size-3.5", isFetching && "animate-spin")} />
            <span>Refresh</span>
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedTabs
          label="Request lists"
          value={tab}
          onChange={(v) => set({ tab: v, status: "all", page: "1" })}
          options={[
            { value: "active", label: "Active Requests", icon: ListChecks, count: activeCount },
            { value: "history", label: "History", icon: History, count: historyCount },
          ]}
        />
        <SearchInput value={search} onChange={setSearch} placeholder="Search reference, resident, property or lot…" className="sm:max-w-sm" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
        <FilterSelect label="Status" value={values.status} onChange={(v) => set({ status: v, page: "1" })} options={statusOptions} />
        <FilterCombobox label="Category" value={values.category} onChange={(v) => set({ category: v, page: "1" })} options={categoryOptions} placeholder="Search categories…" />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={filtersOn ? Filter : ListChecks}
          title={filtersOn ? "No requests match" : totalMine === 0 ? "Nothing assigned to you yet" : tab === "active" ? "No active requests" : "No history yet"}
          description={
            filtersOn
              ? "Try a different search or clear the filters."
              : totalMine === 0
                ? "Requests assigned to you will appear here, and you'll be notified when one arrives."
                : tab === "active" ? "Requests you are working on will appear here." : "Completed, rejected and withdrawn requests will appear here."
          }
          action={
            filtersOn ? (
              <Button variant="outline" onClick={() => { setSearch(""); set({ status: "all", category: "all", page: "1" }); }}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <TableFrame
          footer={
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
          }
        >
          <RequestsTable rows={rows} />
        </TableFrame>
      )}
    </div>
  );
}
