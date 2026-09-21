"use client";

import { useMemo, useState } from "react";
import { Eye, Filter, History, Hourglass, ListChecks, UserRoundPlus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
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
import { RequestsTable } from "@/features/requests/components/requests-table";
import { useRequests, useResidents, useReviewers } from "@/hooks/use-reviewer-data";
import { useMe } from "@/hooks/use-current-user";
import { usePageSize } from "@/hooks/use-page-size";
import { useUrlParams, useUrlSearch } from "@/hooks/use-url-params";
import { IN_FLIGHT, STATUS_LABEL, STATUS_ORDER, residentFullName } from "@/lib/domain";

type Tab = "active" | "history";

/** Default reviewers track every request's progress and can reassign work in flight. */
export default function OversightPage() {
  const { me, isDefault } = useMe();
  const { data: requests, isLoading } = useRequests();
  const { data: residents } = useResidents();
  const { data: reviewers } = useReviewers();
  const { values, set } = useUrlParams({ tab: "active", status: "all", reviewer: "all", page: "1" });
  const [search, setSearch] = useUrlSearch("q");
  const [pageSize, setPageSize] = usePageSize();
  const [target, setTarget] = useState<RequestRecord | null>(null);
  const tab: Tab = values.tab === "history" ? "history" : "active";

  const residentById = useMemo(() => new Map((residents ?? []).map((r) => [r.id, r])), [residents]);
  const reviewerById = useMemo(() => new Map((reviewers ?? []).map((r) => [r.id, r])), [reviewers]);

  if (me && !isDefault) return <DefaultReviewersOnly />;

  const all = requests ?? [];
  const active = all.filter((r) => IN_FLIGHT.includes(r.status));
  const history = all.filter((r) => !IN_FLIGHT.includes(r.status));
  const waitingOnResident = active.filter((r) => r.status === "changes_required").length;
  const withReviewers = active.filter((r) => r.assignedReviewerId).length;

  const q = search.trim().toLowerCase();
  const source = tab === "active" ? active : history;
  const rows = source.filter((r) => {
    if (values.status !== "all" && r.status !== values.status) return false;
    if (values.reviewer === "unassigned" ? !!r.assignedReviewerId : values.reviewer !== "all" && r.assignedReviewerId !== values.reviewer) return false;
    if (!q) return true;
    const res = residentById.get(r.residentId);
    const rev = r.assignedReviewerId ? reviewerById.get(r.assignedReviewerId) : undefined;
    return `${r.code} ${r.categoryName} ${residentFullName(res)} ${r.fieldValues.propertyAddress} ${rev?.name ?? ""}`.toLowerCase().includes(q);
  });

  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(Math.max(1, Number(values.page) || 1), pages);
  const visible = rows.slice((page - 1) * pageSize, page * pageSize);
  const filtersOn = values.status !== "all" || values.reviewer !== "all" || !!q;

  const reviewerOptions = [
    { label: "All reviewers", value: "all" },
    { label: "Unassigned", value: "unassigned" },
    ...(reviewers ?? []).filter((r) => r.loginEnabled).map((r) => ({ label: r.name, value: r.id })).sort((a, b) => a.label.localeCompare(b.label)),
  ];
  const statusOptions = [{ label: "All statuses", value: "all" }, ...STATUS_ORDER.map((s) => ({ label: STATUS_LABEL[s], value: s }))];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader title="Request Oversight" description="Track progress across every reviewer's requests and reassign work that is in progress." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active requests" value={active.length} icon={ListChecks} accent="navy" hint="Across all reviewers" />
        <StatCard label="With a reviewer" value={withReviewers} icon={Eye} accent="blue" hint="Owned and moving" />
        <StatCard label="Waiting on residents" value={waitingOnResident} icon={Hourglass} accent="amber" hint="Changes required" />
        <StatCard label="History" value={history.length} icon={History} accent="emerald" hint="Completed, rejected, withdrawn" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedTabs
          label="Oversight lists"
          value={tab}
          onChange={(v) => set({ tab: v, status: "all", page: "1" })}
          options={[
            { value: "active", label: "Active Requests", icon: ListChecks, count: active.length },
            { value: "history", label: "History", icon: History, count: history.length },
          ]}
        />
        <SearchInput value={search} onChange={setSearch} placeholder="Search reference, resident, property or reviewer…" className="sm:max-w-sm" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
        <FilterSelect label="Status" value={values.status} onChange={(v) => set({ status: v, page: "1" })} options={statusOptions} />
        <FilterCombobox label="Reviewer" value={values.reviewer} onChange={(v) => set({ reviewer: v, page: "1" })} options={reviewerOptions} placeholder="Search reviewers…" />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={filtersOn ? Filter : Eye}
          title={filtersOn ? "No requests match" : "Nothing to show"}
          description={filtersOn ? "Try a different search or clear the filters." : "There are no requests in this list."}
          action={
            filtersOn ? (
              <Button variant="outline" onClick={() => { setSearch(""); set({ status: "all", reviewer: "all", page: "1" }); }}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          <RequestsTable
            rows={visible}
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

      <AssignReviewerDialog request={target} onOpenChange={(o) => !o && setTarget(null)} />
    </div>
  );
}
