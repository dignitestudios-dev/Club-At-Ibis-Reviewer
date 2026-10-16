"use client";

import { useState } from "react";
import { DateRangeFilter } from "@/components/shared/date-range-filter";
import { ClearFiltersLink, FilterSidebar, FiltersButton } from "@/components/shared/filter-sidebar";
import { FilterSelect } from "@/components/shared/filter-select";
import { usableRange } from "@/lib/date-range";

/** The staff-only request filters beyond search / status / category (kept in the URL as these keys). */
export const ADVANCED_FILTER_DEFAULTS = { categoryStatus: "all", deposit: "all", refund: "all", from: "", to: "" };

export type AdvancedFilterValues = typeof ADVANCED_FILTER_DEFAULTS;

const CATEGORY_STATUS = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Archived", value: "archived" },
];
const DEPOSIT = [
  { label: "Any deposit status", value: "all" },
  { label: "Not required", value: "not_required" },
  { label: "Pending", value: "pending" },
  { label: "Received", value: "received" },
];
const REFUND = [
  { label: "Any refund outcome", value: "all" },
  { label: "Awaiting refund action", value: "awaiting_refund_action" },
  { label: "Refunded", value: "refunded" },
  { label: "No refund", value: "no_refund" },
];

/** API params for the advanced filters. An invalid date range is never sent. */
export function advancedParams(v: AdvancedFilterValues) {
  const range = usableRange(v.from, v.to);
  return {
    categoryStatus: v.categoryStatus !== "all" ? v.categoryStatus : undefined,
    depositStatus: v.deposit !== "all" ? v.deposit : undefined,
    refundOutcome: v.refund !== "all" ? v.refund : undefined,
    submittedFrom: range.from,
    submittedTo: range.to,
  };
}

export function advancedActiveCount(v: AdvancedFilterValues): number {
  return [v.categoryStatus !== "all", v.deposit !== "all", v.refund !== "all", !!v.from || !!v.to].filter(Boolean).length;
}

/** Human-readable list of the selected advanced criteria, for the no-match message. */
export function advancedCriteria(v: AdvancedFilterValues): string[] {
  const label = (items: { label: string; value: string }[], value: string) => items.find((i) => i.value === value)?.label ?? value;
  return [
    v.categoryStatus !== "all" && `${label(CATEGORY_STATUS, v.categoryStatus).toLowerCase()} categories`,
    v.deposit !== "all" && `deposit ${label(DEPOSIT, v.deposit).toLowerCase()}`,
    v.refund !== "all" && `refund ${label(REFUND, v.refund).toLowerCase()}`,
    (v.from || v.to) && `submitted ${v.from || "…"} to ${v.to || "…"}`,
  ].filter(Boolean) as string[];
}

/**
 * The "Filters" button plus the sidebar with the staff filters: submitted date, category status,
 * deposit status and refund outcome. A "Clear all filters" link shows next to the button while any filter
 * or search is applied.
 */
export function StaffAdvancedFilters({
  values,
  onChange,
  anyFilterActive = false,
  onClearAll,
}: {
  values: AdvancedFilterValues;
  onChange: (next: Partial<AdvancedFilterValues>) => void;
  /** True when any filter (or the search) is applied anywhere on the page. */
  anyFilterActive?: boolean;
  onClearAll?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const active = advancedActiveCount(values);
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <FiltersButton count={active} onClick={() => setOpen(true)} expanded={open} />
        {anyFilterActive && onClearAll && <ClearFiltersLink onClick={onClearAll} />}
      </div>
      <FilterSidebar
        open={open}
        onOpenChange={setOpen}
        title="More filters"
        onClear={onClearAll}
        clearDisabled={!anyFilterActive}
      >
        <FilterSelect label="Category status" value={values.categoryStatus} onChange={(v) => onChange({ categoryStatus: v })} options={CATEGORY_STATUS} />
        <FilterSelect label="Deposit status" value={values.deposit} onChange={(v) => onChange({ deposit: v })} options={DEPOSIT} />
        <FilterSelect label="Refund outcome" value={values.refund} onChange={(v) => onChange({ refund: v })} options={REFUND} />
        <DateRangeFilter from={values.from} to={values.to} onChange={(r) => onChange(r)} idPrefix="staff-submitted" stacked />
      </FilterSidebar>
    </>
  );
}
