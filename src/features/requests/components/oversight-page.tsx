"use client";

import { useMemo, useRef, useState } from "react";
import { Eye, Filter, History, Hourglass, ListChecks, RefreshCw, UserRoundPlus } from "lucide-react";
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
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DefaultReviewersOnly } from "@/features/requests/components/incoming-page";
import { AssignReviewerDialog } from "@/features/requests/components/assign-reviewer-dialog";
import { TableFrame } from "@/components/shared/table-frame";
import { RequestsTable } from "@/features/requests/components/requests-table";
import { useCategories, useRequestsPage, useReviewers } from "@/hooks/use-reviewer-data";
import { useMe } from "@/hooks/use-current-user";
import { usePageSize } from "@/hooks/use-page-size";
import { useToast } from "@/hooks/use-toast";
import { useUrlParams, useUrlSearch } from "@/hooks/use-url-params";
import { IN_FLIGHT, STATUS_LABEL, STATUS_ORDER } from "@/lib/domain";
import { cn } from "@/utils/cn";

type Tab = "active" | "history";

const ACTIVE_STATUSES = "submitted,assigned,under_review,changes_required,resubmitted,approved";
const HISTORY_STATUSES = "completed,rejected,withdrawn";

/** Default reviewers track every request's progress and can reassign work in flight. */
export default function OversightPage() {
  const toast = useToast();
  const { me, isDefault } = useMe();
  const { values, set } = useUrlParams({ tab: "active", status: "all", reviewer: "all", category: "all", page: "1", ...ADVANCED_FILTER_DEFAULTS });
  const [search, setSearch] = useUrlSearch("q");
  const [pageSize, setPageSize] = usePageSize();
  const [target, setTarget] = useState<RequestRecord | null>(null);
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
    assignedReviewerId: values.reviewer !== "all" ? values.reviewer : undefined,
  };
  const listFilters = { ...baseFilters, status: statusParam };

  const { data: pageData, isLoading, isError, isFetching, refetch } = useRequestsPage(
    {
      page,
      limit: pageSize,
      ...listFilters,
    },
    { enabled: isDefault }
  );

  // Active/History StatCards and tab badges come from the same paginated
  // endpoint's `pagination.total` for each status bucket — not a separately
  // fetched, 100-row-capped "all requests" list that silently undercounts
  // once there are more than 100 requests system-wide.
  // Tab badges follow the current search and filters: the open tab uses the list's own total, the other tab asks
  // the same endpoint with the same filters. (The stat cards above stay global.)
  const { data: otherTabPage } = useRequestsPage(
    { limit: 1, ...baseFilters, status: tab === "active" ? HISTORY_STATUSES : ACTIVE_STATUSES },
    { enabled: isDefault }
  );
  const { data: activeTotalsPage } = useRequestsPage({ limit: 1, status: ACTIVE_STATUSES }, { enabled: isDefault });
  const { data: historyTotalsPage } = useRequestsPage({ limit: 1, status: HISTORY_STATUSES }, { enabled: isDefault });
  const { data: changesRequiredPage } = useRequestsPage({ limit: 1, status: "changes_required" }, { enabled: isDefault });
  // "With a reviewer" = active requests that have moved past "submitted"
  // (every later status implies an assignment already happened), so it's a
  // plain status filter too — no need to fetch and scan raw request rows.
  const { data: withReviewerPage } = useRequestsPage(
    { limit: 1, status: "assigned,under_review,changes_required,resubmitted,approved" },
    { enabled: isDefault }
  );
  const { data: reviewers } = useReviewers(undefined, { enabled: isDefault });
  const { data: categories } = useCategories();

  if (me && !isDefault) return <DefaultReviewersOnly />;

  const activeCount = activeTotalsPage?.pagination?.total ?? 0;
  const historyCount = historyTotalsPage?.pagination?.total ?? 0;
  const waitingOnResident = changesRequiredPage?.pagination?.total ?? 0;
  const withReviewers = withReviewerPage?.pagination?.total ?? 0;

  const rows = pageData?.requests ?? [];
  const total = pageData?.pagination?.total ?? 0;
  const otherTabTotal = otherTabPage?.pagination?.total ?? 0;
  const tabActiveCount = tab === "active" ? total : otherTabTotal;
  const tabHistoryCount = tab === "history" ? total : otherTabTotal;

  function clearAll() {
    tabStatusRef.current = { active: "all", history: "all" };
    setSearch("");
    set({ status: "all", reviewer: "all", category: "all", page: "1", ...ADVANCED_FILTER_DEFAULTS });
  }
  const q = search.trim();
  const filtersOn = values.status !== "all" || values.reviewer !== "all" || values.category !== "all" || !!q || advancedActiveCount(advanced) > 0;
  const criteriaText = [
    q && `search "${q}"`,
    values.status !== "all" && `status ${STATUS_LABEL[values.status as RequestStatus] ?? values.status}`,
    values.reviewer !== "all" && `reviewer ${reviewers?.find((r) => r.id === values.reviewer)?.name ?? ""}`.trim(),
    values.category !== "all" && `category ${categories?.find((c) => c.id === values.category)?.name ?? ""}`.trim(),
    ...advancedCriteria(advanced),
  ]
    .filter(Boolean)
    .join(", ");

  const reviewerOptions = [
    { label: "All reviewers", value: "all" },
    ...(reviewers ?? []).filter((r) => r.loginEnabled).map((r) => ({ label: r.name, value: r.id })).sort((a, b) => a.label.localeCompare(b.label)),
  ];
  const categoryOptions = [
    { label: "All categories", value: "all" },
    ...[...(categories ?? [])].sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ label: c.name, value: c.id })),
  ];
  const statusOptions = [
    { label: "All statuses", value: "all" },
    ...(tab === "active" ? STATUS_ORDER.filter((s) => IN_FLIGHT.includes(s)) : STATUS_ORDER.filter((s) => !IN_FLIGHT.includes(s))).map((s) => ({
      label: STATUS_LABEL[s],
      value: s,
    })),
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Request Oversight"
        description="See the latest updates for your requests, including new submissions, resubmissions, and review activity."
        actions={
          <div className="flex items-center gap-2">
            <ExportCsvButton filters={listFilters} />
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                await refetch();
                toast.success("Oversight requests refreshed");
              } catch {
                toast.error("Failed to refresh oversight requests");
              }
            }}
            disabled={isFetching}
            className="h-8 gap-1.5"
            aria-label="Refresh oversight requests"
            title="Refresh oversight requests"
          >
            <RefreshCw className={cn("size-3.5", isFetching && "animate-spin")} />
            <span>Refresh</span>
          </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active requests" value={activeCount} icon={ListChecks} accent="navy" hint="Across all reviewers" />
        <StatCard label="With a reviewer" value={withReviewers} icon={Eye} accent="blue" hint="Owned and moving" />
        <StatCard label="Waiting on residents" value={waitingOnResident} icon={Hourglass} accent="amber" hint="Changes required" />
        <StatCard label="History" value={historyCount} icon={History} accent="emerald" hint="Completed, rejected, withdrawn" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedTabs
          label="Oversight lists"
          value={tab}
          onChange={(v) => {
            const nextTab = v === "history" ? "history" : "active";
            tabStatusRef.current[tab] = values.status;
            const restoredStatus = tabStatusRef.current[nextTab] || "all";
            set({ tab: nextTab, status: restoredStatus, page: "1" });
          }}
          options={[
            { value: "active", label: "Active Requests", icon: ListChecks, count: tabActiveCount },
            { value: "history", label: "History", icon: History, count: tabHistoryCount },
          ]}
        />
        <SearchInput value={search} onChange={setSearch} placeholder="Search reference, resident, property or reviewer…" className="sm:max-w-sm" />
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
        <FilterCombobox className="w-full sm:w-64" label="Reviewer" value={values.reviewer} onChange={(v) => set({ reviewer: v, page: "1" })} options={reviewerOptions} placeholder="Search reviewers…" />
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
        <ErrorState title="We couldn't load the requests" onRetry={() => void refetch()} retrying={isFetching} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={filtersOn ? Filter : Eye}
          title={filtersOn ? "No requests match" : "Nothing to show"}
          description={filtersOn ? `No requests match: ${criteriaText}. Adjust the filters or clear them.` : "There are no requests in this list."}
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
          <RequestsTable
            rows={rows}
            query={search}
            showReviewer
            renderActions={(req) =>
            IN_FLIGHT.includes(req.status) ? (
              <Button size="sm" variant="outline" onClick={() => setTarget(req)}>
                <UserRoundPlus />
                {req.assignedReviewerId ? "Reassign" : "Assign"}
              </Button>
              ) : null
            }
          />
        </TableFrame>
      )}

      <AssignReviewerDialog request={target} onOpenChange={(o) => !o && setTarget(null)} />
    </div>
  );
}
