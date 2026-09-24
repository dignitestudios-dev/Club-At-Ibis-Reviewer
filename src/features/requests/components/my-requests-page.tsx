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
import { RequestsTable } from "@/features/requests/components/requests-table";
import { useRequests, useResidents } from "@/hooks/use-reviewer-data";
import { useMe } from "@/hooks/use-current-user";
import { usePageSize } from "@/hooks/use-page-size";
import { useToast } from "@/hooks/use-toast";
import { useUrlParams, useUrlSearch } from "@/hooks/use-url-params";
import { IN_FLIGHT, STATUS_LABEL, STATUS_ORDER, residentFullName } from "@/lib/domain";
import { cn } from "@/utils/cn";

type Tab = "active" | "history";

export default function MyRequestsPage() {
  const toast = useToast();
  const { me } = useMe();
  const { data: requests, isLoading, isFetching, refetch } = useRequests();
  const { data: residents } = useResidents();
  const { values, set } = useUrlParams({ tab: "active", status: "all", category: "all", page: "1" });
  const [search, setSearch] = useUrlSearch("q");
  const [pageSize, setPageSize] = usePageSize();
  const tab: Tab = values.tab === "history" ? "history" : "active";

  const mine = useMemo(() => (requests ?? []).filter((r) => r.assignedReviewerId === me?.id), [requests, me?.id]);
  // Active: still moving through the workflow. History: completed, rejected or withdrawn.
  const activeList = mine.filter((r) => IN_FLIGHT.includes(r.status));
  const historyList = mine.filter((r) => !IN_FLIGHT.includes(r.status));

  const residentById = useMemo(() => new Map((residents ?? []).map((r) => [r.id, r])), [residents]);
  const q = search.trim().toLowerCase();
  const source = tab === "active" ? activeList : historyList;
  const rows = source.filter((r) => {
    if (values.status !== "all" && r.status !== values.status) return false;
    if (values.category !== "all" && r.categoryId !== values.category) return false;
    if (!q) return true;
    const res = residentById.get(r.residentId);
    return `${r.code} ${r.categoryName} ${residentFullName(res)} ${res?.residentIdNumber ?? ""} ${r.fieldValues.propertyAddress} ${r.fieldValues.lotNo}`.toLowerCase().includes(q);
  });

  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(Math.max(1, Number(values.page) || 1), pages);
  const visible = rows.slice((page - 1) * pageSize, page * pageSize);
  const filtersOn = values.status !== "all" || values.category !== "all" || !!q;

  const categoryOptions = useMemo(
    () => [
      { label: "All categories", value: "all" },
      ...[...new Map(mine.map((r) => [r.categoryId, r.categoryName])).entries()].map(([value, label]) => ({ label, value })).sort((a, b) => a.label.localeCompare(b.label)),
    ],
    [mine]
  );
  const statusOptions = [{ label: "All statuses", value: "all" }, ...STATUS_ORDER.map((s) => ({ label: STATUS_LABEL[s], value: s }))];

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
          onChange={(v) => set({ tab: v, page: "1" })}
          options={[
            { value: "active", label: "Active Requests", icon: ListChecks, count: activeList.length },
            { value: "history", label: "History", icon: History, count: historyList.length },
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
          title={filtersOn ? "No requests match" : mine.length === 0 ? "Nothing assigned to you yet" : tab === "active" ? "No active requests" : "No history yet"}
          description={
            filtersOn
              ? "Try a different search or clear the filters."
              : mine.length === 0
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
        <div className="space-y-4">
          <RequestsTable rows={visible} />
          <Pagination
            page={page}
            pageSize={pageSize}
            total={rows.length}
            onPageChange={(p) => set({ page: String(p) })}
            onPageSizeChange={(n) => {
              setPageSize(n);
              set({ page: "1" });
            }}
          />
        </div>
      )}
    </div>
  );
}
