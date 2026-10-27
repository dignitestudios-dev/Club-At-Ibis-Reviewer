"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PAGE_SIZE_OPTIONS } from "@/hooks/use-page-size";

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  const numbers: (number | "…")[] = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 1) numbers.push(p);
    else if (numbers[numbers.length - 1] !== "…") numbers.push("…");
  }

  const sizeItems = PAGE_SIZE_OPTIONS.map((n) => ({ label: String(n), value: String(n) }));

  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xs text-muted-foreground" aria-live="polite">
          Showing <span className="font-semibold text-foreground">{from} to {to}</span> of{" "}
          <span className="font-semibold text-foreground">{total}</span>
        </p>
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Rows per page</span>
            <Select items={sizeItems} value={String(pageSize)} onValueChange={(v) => v && onPageSizeChange(Number(v))}>
              <SelectTrigger size="sm" className="w-[4.5rem]" aria-label="Rows per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sizeItems.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      {pages > 1 && (
        <nav className="flex items-center gap-1 max-sm:w-full max-sm:justify-between" aria-label="Pagination">
          <Button variant="outline" size="icon-sm" className="max-sm:size-11" onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Previous page">
            <ChevronLeft />
          </Button>
          {numbers.map((n, i) =>
            n === "…" ? (
              <span key={`gap-${i}`} className="px-1 text-xs text-muted-foreground max-sm:hidden">…</span>
            ) : (
              <Button
                key={n}
                variant={n === page ? "default" : "ghost"}
                size="icon-sm"
                onClick={() => onPageChange(n)}
                aria-current={n === page ? "page" : undefined}
                className="text-xs tabular-nums max-sm:hidden"
              >
                {n}
              </Button>
            )
          )}
          <span className="text-xs font-medium tabular-nums text-muted-foreground sm:hidden">Page {page} of {pages}</span>
          <Button variant="outline" size="icon-sm" className="max-sm:size-11" onClick={() => onPageChange(page + 1)} disabled={page >= pages} aria-label="Next page">
            <ChevronRight />
          </Button>
        </nav>
      )}
    </div>
  );
}
