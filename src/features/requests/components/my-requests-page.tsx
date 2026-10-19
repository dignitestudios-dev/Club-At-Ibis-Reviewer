"use client";

import { useMemo, useRef } from "react";
import { Filter, History, ListChecks, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState } from "@/components/shared/error-state";
import { ADVANCED_FILTER_DEFAULTS, StaffAdvancedFilters, advancedActiveCount, advancedCriteria, advancedParams, type AdvancedFilterValues } from "@/components/shared/staff-filters";
import { ExportCsvButton } from "@/features/requests/components/export-csv-button";
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
  const { values, set } = useUrlParams({ tab: "active", status: "all", category: "all", page: "1", ...ADVANCED_FILTER_DEFAULTS });
  const [search, setSearch] = useUrlSearch("q");
  const [pageSize, setPageSize] = usePageSize();
  const tab: Tab = values.tab === "history" ? "history" : "active";

  const tabStatusRef = useRef<Record<Tab, string>>({
    active: values.tab === "active" ? values.status : "all",
    history: values.tab === "history" ? values.status : "all",
  });

  const page = Math.max(1, Number(values.page) || 1);
  const statusParam = values.status !== "all" ? values.status : tab === "active" ? ACTIVE_STATUSES : HISTORY_STATUSES;

  const advanced: AdvancedFilterValues = {
    categoryStatus: values.categoryStatus,
    deposit: values.deposit,
    refund: values.refund,
    from: values.from,
    to: values.to,
  };

  // The list's search and filters, also used by the CSV export (without page / limit).
  const baseFilters = {
    search: search.trim() || undefined,
    categoryId: values.category !== "all" ? values.category : undefined,
    ...advancedParams(advanced),
    assignedReviewerId: isDefault ? me?.id : undefined,
  };
  const listFilters = { ...baseFilters, status: statusParam };

  const { data: pageData, isLoading, isError, isFetching, refetch } = useRequestsPage(
    {
      page,
      limit: pageSize,
      ...listFilters,
    },
    { enabled: !me ? false : true }
  );

  // Tab badges follow the current search and filters, so the open tab's badge always equals the list's total.
  // The open tab uses the list's own total; the other tab asks the same endpoint with the same filters.
  const { data: otherTabPage } = useRequestsPage(
    { limit: 1, ...baseFilters, status: tab === "active" ? HISTORY_STATUSES : ACTIVE_STATUSES },
    { enabled: !me ? false : true }
  );

  // Unfiltered totals: only used to tell "nothing assigned yet" apart from "nothing matches the filters".
  const { data: activeTotalsPage } = useRequestsPage(
    { limit: 1, status: ACTIVE_STATUSES, assignedReviewerId: isDefault ? me?.id : undefined },
    { enabled: !me ? false : true }
  );
  const { data: historyTotalsPage } = useRequestsPage(
    { limit: 1, status: HISTORY_STATUSES, assignedReviewerId: isDefault ? me?.id : undefined },
    { enabled: !me ? false : true }
  );
  const { data: categories } = useCategories({ includeArchived: true });

  const rows = pageData?.requests ?? [];
  const total = pageData?.pagination?.total ?? 0;
  const q = search.trim();
  const filtersOn = values.status !== "all" || values.category !== "all" || !!q || advancedActiveCount(advanced) > 0;
  const criteriaText = [
    q && `search "${q}"`,
    values.status !== "all" && `status ${STATUS_LABEL[values.status as RequestStatus] ?? values.status}`,
    values.category !== "all" && "the selected category",
    ...advancedCriteria(advanced),
  ]
    .filter(Boolean)
    .join(", ");

  const otherTabTotal = otherTabPage?.pagination?.total ?? 0;
  const activeCount = tab === "active" ? total : otherTabTotal;
  const historyCount = tab === "history" ? total : otherTabTotal;
  const totalMine = (activeTotalsPage?.pagination?.total ?? 0) + (historyTotalsPage?.pagination?.total ?? 0);

  function clearAll() {
    tabStatusRef.current = { active: "all", history: "all" };
    setSearch("");
    set({ status: "all", category: "all", page: "1", ...ADVANCED_FILTER_DEFAULTS });
  }

  const categoryOptions = useMemo(
    () => [
      { label: "All categories", value: "all" },
      ...(categories ?? [])
        .map((c) => ({
          label: c.status === "archived" ? `${c.name} (archived)` : c.name,
          value: c.id,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
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
        title="Assigned Review Requests"
        description="Manage your assigned requests. Open a request to review its details, view documents, and record your decision."
        actions={
          <div className="flex items-center gap-2">
            <ExportCsvButton filters={listFilters} />
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
          </div>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedTabs
          label="Request lists"
          value={tab}
          onChange={(v) => {
            const nextTab = v === "history" ? "history" : "active";
            tabStatusRef.current[tab] = values.status;
            const restoredStatus = tabStatusRef.current[nextTab] || "all";
            set({ tab: nextTab, status: restoredStatus, page: "1" });
          }}
          options={[
            { value: "active", label: "Active Requests", icon: ListChecks, count: activeCount },
            { value: "history", label: "History", icon: History, count: historyCount },
          ]}
        />
        <SearchInput value={search} onChange={setSearch} placeholder="Search reference, resident, property or lot…" className="sm:max-w-sm" />
      </div>

      {/* Search and selects share one row with the Filters button. */}
      <div className="flex flex-wrap items-end gap-3">
        <FilterSelect
          className="w-full sm:w-56"
          label="Status"
          value={values.status}
          onChange={(v) => {
            tabStatusRef.current[tab] = v;
            set({ status: v, page: "1" });
          }}
          options={statusOptions}
        />
        <FilterCombobox className="w-full sm:w-64" label="Category" value={values.category} onChange={(v) => set({ category: v, page: "1" })} options={categoryOptions} placeholder="Search categories…" />
        <StaffAdvancedFilters values={advanced} onChange={(next) => set({ ...next, page: "1" })} anyFilterActive={filtersOn} onClearAll={clearAll} />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState title="We couldn't load your requests" onRetry={() => void refetch()} retrying={isFetching} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={filtersOn ? Filter : ListChecks}
          title={filtersOn ? "No requests match" : totalMine === 0 ? "Nothing assigned to you yet" : tab === "active" ? "No active requests" : "No history yet"}
          description={
            filtersOn
              ? `No requests match: ${criteriaText}. Adjust the filters or clear them.`
              : totalMine === 0
                ? "Requests assigned to you will appear here, and you'll be notified when one arrives."
                : tab === "active" ? "Requests you are working on will appear here." : "Completed, rejected and withdrawn requests will appear here."
          }
          action={
            filtersOn ? (
              <Button variant="outline" onClick={clearAll}>
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
          <RequestsTable rows={rows} query={search} />
        </TableFrame>
      )}
    </div>
  );
}
