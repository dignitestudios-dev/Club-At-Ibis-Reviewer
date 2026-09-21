"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ChevronRight } from "lucide-react";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { StatusBadge } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useResidents, useReviewers } from "@/hooks/use-reviewer-data";
import { nextStep, residentFullName } from "@/lib/domain";
import { formatRelative } from "@/utils/format";
import { cn } from "@/utils/cn";

const TONE = {
  action: "text-primary dark:text-amber-300",
  waiting: "text-muted-foreground",
  done: "text-muted-foreground",
} as const;

/** Shared table for the reviewer's request lists. Rows open the request. */
export function RequestsTable({
  rows,
  showReviewer = false,
  renderActions,
}: {
  rows: RequestRecord[];
  showReviewer?: boolean;
  renderActions?: (req: RequestRecord) => React.ReactNode;
}) {
  const router = useRouter();
  const { data: residents } = useResidents();
  const { data: reviewers } = useReviewers();
  const residentById = useMemo(() => new Map((residents ?? []).map((r) => [r.id, r])), [residents]);
  const reviewerById = useMemo(() => new Map((reviewers ?? []).map((r) => [r.id, r])), [reviewers]);

  return (
    <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xs">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="pl-4">Request</TableHead>
            <TableHead>Resident</TableHead>
            <TableHead>Property</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Next step</TableHead>
            {showReviewer && <TableHead>Reviewer</TableHead>}
            <TableHead>Submitted</TableHead>
            {renderActions && (
              <TableHead className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            )}
            <TableHead className="w-10 pr-4">
              <span className="sr-only">Open</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((req) => {
            const step = nextStep(req);
            const reviewer = req.assignedReviewerId ? reviewerById.get(req.assignedReviewerId) : undefined;
            return (
              <TableRow key={req.id} className="group cursor-pointer" onClick={() => router.push(`/requests/${req.id}`)}>
                <TableCell className="pl-4">
                  <Link
                    href={`/requests/${req.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="block font-mono text-xs font-semibold text-primary hover:underline dark:text-amber-300"
                  >
                    {req.code}
                  </Link>
                  <span className="block max-w-[190px] truncate text-sm font-medium text-foreground">{req.categoryName}</span>
                </TableCell>
                <TableCell className="text-sm whitespace-nowrap">{residentFullName(residentById.get(req.residentId))}</TableCell>
                <TableCell>
                  <span className="block max-w-[190px] truncate text-sm text-muted-foreground">{req.fieldValues.propertyAddress}</span>
                </TableCell>
                <TableCell>
                  <StatusBadge status={req.status} />
                </TableCell>
                <TableCell>
                  <span className={cn("text-xs font-medium", TONE[step.tone])}>{step.label}</span>
                </TableCell>
                {showReviewer && (
                  <TableCell>
                    {reviewer ? (
                      <div className="flex items-center gap-2">
                        <PersonAvatar name={reviewer.name} className="size-7" fallbackClassName="text-[10px]" />
                        <span className="text-sm whitespace-nowrap">{reviewer.name}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Unassigned</span>
                    )}
                  </TableCell>
                )}
                <TableCell className="whitespace-nowrap">
                  <span className="block text-sm">{formatRelative(req.submittedAt)}</span>
                  <span className="block text-[11px] text-muted-foreground">{format(new Date(req.submittedAt), "MMM d, yyyy")}</span>
                </TableCell>
                {renderActions && (
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    {renderActions(req)}
                  </TableCell>
                )}
                <TableCell className="pr-4">
                  <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
