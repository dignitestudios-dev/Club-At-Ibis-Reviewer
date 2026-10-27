"use client";

import { ProcessingChip, hasProcessingState, isRefundPending } from "@/components/shared/processing-chip";
import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ChevronRight, Clock, MapPin, UserRound } from "lucide-react";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { Highlight } from "@/components/shared/highlight";
import { StatusBadge } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useResidents, useReviewers } from "@/hooks/use-reviewer-data";
import { useMe } from "@/hooks/use-current-user";
import { nextStep, residentFullName } from "@/lib/domain";
import { formatRelative } from "@/utils/format";
import { cn } from "@/utils/cn";

const TONE = {
  action: "text-primary dark:text-amber-300",
  waiting: "text-muted-foreground",
  done: "text-muted-foreground",
} as const;

/**
 * Shared list of the reviewer's requests. Rows open the request. Render it inside <TableFrame>.
 * From md up it is a table; on phones each request is a tappable card (a wide table is unusable there).
 */
export function RequestsTable({
  rows,
  showReviewer = false,
  renderActions,
  query,
}: {
  rows: RequestRecord[];
  showReviewer?: boolean;
  /** The current search text: matching parts of the row are highlighted. */
  query?: string;
  renderActions?: (req: RequestRecord) => React.ReactNode;
}) {
  const router = useRouter();
  const { isDefault } = useMe();
  const { data: residents } = useResidents();
  const { data: reviewers } = useReviewers({ includeDeactivated: true }, { enabled: showReviewer && isDefault });
  const residentById = useMemo(() => new Map((residents ?? []).map((r) => [r.id, r])), [residents]);
  const reviewerById = useMemo(() => new Map((reviewers ?? []).map((r) => [r.id, r])), [reviewers]);

  function describe(req: RequestRecord) {
    const resident = req.resident
      ? {
          id: req.resident.id,
          residentIdNumber: req.resident.residentId || req.resident.residentIdNumber || "",
          firstName: req.resident.firstName || "",
          lastName: req.resident.lastName || "",
          displayName: req.resident.displayName || "",
          email: req.resident.email || "",
          phone: req.resident.phone || "",
          active: true,
          address: req.property?.address || req.fieldValues?.propertyAddress || "",
          lotNo: req.property?.lotNo || req.fieldValues?.lotNo || "",
          createdAt: "",
        }
      : residentById.get(req.residentId);
    return {
      step: nextStep(req),
      reviewer: req.assignedReviewerId ? reviewerById.get(req.assignedReviewerId) : undefined,
      resName: residentFullName(resident),
      propAddress: req.property?.address || req.fieldValues?.propertyAddress || "—",
    };
  }

  return (
    <>
      {/* Phones: one card per request. */}
      <ul className="space-y-3 md:hidden" aria-label="Requests">
        {rows.map((req) => {
          const { step, reviewer, resName, propAddress } = describe(req);
          return (
            <li
              key={req.id}
              className={cn(
                "overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xs",
                isRefundPending(req) && "border-amber-300/80 bg-amber-50/60 dark:border-amber-800/70 dark:bg-amber-950/15"
              )}
            >
              <Link
                href={`/requests/${req.id}`}
                className="block p-3.5 outline-none transition-colors active:bg-muted/50 focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-semibold text-primary dark:text-amber-300">
                      <Highlight text={req.code} query={query} />
                    </p>
                    <p className="mt-0.5 text-sm font-semibold leading-snug text-foreground break-words [overflow-wrap:anywhere]">
                      <Highlight text={req.categoryName} query={query} />
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <StatusBadge status={req.status} />
                    <ChevronRight className="size-4 text-muted-foreground/60" aria-hidden="true" />
                  </div>
                </div>

                <dl className="mt-3 space-y-1.5 text-xs">
                  <div className="flex items-start gap-2">
                    <dt className="mt-0.5 shrink-0 text-muted-foreground">
                      <UserRound className="size-3.5" aria-label="Resident" />
                    </dt>
                    <dd className="min-w-0 text-sm text-foreground break-words [overflow-wrap:anywhere]">
                      <Highlight text={resName} query={query} />
                    </dd>
                  </div>
                  <div className="flex items-start gap-2">
                    <dt className="mt-0.5 shrink-0 text-muted-foreground">
                      <MapPin className="size-3.5" aria-label="Property" />
                    </dt>
                    <dd className="line-clamp-2 min-w-0 text-muted-foreground break-words [overflow-wrap:anywhere]">
                      <Highlight text={propAddress} query={query} />
                    </dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <dt className="shrink-0 text-muted-foreground">
                      <Clock className="size-3.5" aria-label="Submitted" />
                    </dt>
                    <dd className="text-muted-foreground" title={format(new Date(req.submittedAt), "PPP")}>
                      {formatRelative(req.submittedAt)} · {format(new Date(req.submittedAt), "MMM d, yyyy")}
                    </dd>
                  </div>
                  {showReviewer && (
                    <div className="flex items-center gap-2">
                      <dt className="sr-only">Reviewer</dt>
                      <dd className="flex min-w-0 items-center gap-2">
                        {reviewer ? (
                          <>
                            <PersonAvatar name={reviewer.name} className="size-5 shrink-0" fallbackClassName="text-[9px]" />
                            <span className="truncate text-sm text-foreground">
                              <Highlight text={reviewer.name} query={query} />
                            </span>
                          </>
                        ) : (
                          <span className="text-xs italic text-muted-foreground">Unassigned</span>
                        )}
                      </dd>
                    </div>
                  )}
                </dl>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-xl bg-muted/50 px-3 py-2">
                  <p className={cn("min-w-0 text-xs font-semibold break-words", TONE[step.tone])}>
                    <span className="mr-1 font-medium text-muted-foreground">Next:</span>
                    {step.label}
                  </p>
                  {hasProcessingState(req) && <ProcessingChip request={req} />}
                </div>
              </Link>
              {renderActions && (
                <div className="border-t border-border/70 bg-muted/20 p-3 [&>div]:w-full [&_button]:max-sm:h-10 [&_button]:max-sm:flex-1">{renderActions(req)}</div>
              )}
            </li>
          );
        })}
      </ul>

      {/* md and up: the full table. */}
      <Table className="max-md:hidden">
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="pl-4 w-[190px] min-w-[190px]">Request</TableHead>
            <TableHead className="max-w-[180px]">Resident</TableHead>
            <TableHead className="max-w-[190px]">Property</TableHead>
            <TableHead className="min-w-[160px]">Status</TableHead>
            <TableHead className="min-w-[150px] max-w-[190px]">Next step</TableHead>
            <TableHead className="min-w-[150px]">Deposit / refund</TableHead>
            {showReviewer && <TableHead className="max-w-[160px]">Reviewer</TableHead>}
            <TableHead className="max-w-[130px]">Submitted</TableHead>
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
            const { step, reviewer, resName, propAddress } = describe(req);
            return (
              <TableRow key={req.id} className={cn("group cursor-pointer", isRefundPending(req) && "bg-amber-50/60 hover:bg-amber-50 dark:bg-amber-950/15 dark:hover:bg-amber-950/25")} onClick={() => router.push(`/requests/${req.id}`)}>
                <TableCell className="pl-4 w-[190px] min-w-[190px]">
                  <Link
                    href={`/requests/${req.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="block font-mono text-xs font-semibold text-primary hover:underline dark:text-amber-300 whitespace-nowrap"
                    title={req.code}
                  >
                    <Highlight text={req.code} query={query} />
                  </Link>
                  <span className="block max-w-[190px] truncate text-sm font-medium text-foreground" title={req.categoryName}><Highlight text={req.categoryName} query={query} /></span>
                </TableCell>
                <TableCell className="text-sm max-w-[180px]">
                  <span className="block truncate" title={resName}><Highlight text={resName} query={query} /></span>
                </TableCell>
                <TableCell className="max-w-[190px]">
                  <span className="block max-w-[190px] truncate text-sm text-muted-foreground" title={propAddress}><Highlight text={propAddress} query={query} /></span>
                </TableCell>
                <TableCell className="min-w-[160px]">
                  <StatusBadge status={req.status} />
                </TableCell>
                <TableCell className="min-w-[150px] max-w-[190px]">
                  <span className={cn("text-xs font-medium block line-clamp-2 break-words", TONE[step.tone])} title={step.label}>{step.label}</span>
                </TableCell>
                <TableCell className="min-w-[150px]">
                  {hasProcessingState(req) ? <ProcessingChip request={req} /> : <span className="text-xs text-muted-foreground">—</span>}
                </TableCell>
                {showReviewer && (
                  <TableCell className="max-w-[160px]">
                    {reviewer ? (
                      <div className="flex items-center gap-2 min-w-0" title={reviewer.name}>
                        <PersonAvatar name={reviewer.name} className="size-7 shrink-0" fallbackClassName="text-[10px]" />
                        <span className="text-sm truncate"><Highlight text={reviewer.name} query={query} /></span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Unassigned</span>
                    )}
                  </TableCell>
                )}
                <TableCell className="whitespace-nowrap max-w-[130px] truncate" title={format(new Date(req.submittedAt), "PPP")}>
                  <span className="block text-sm truncate">{formatRelative(req.submittedAt)}</span>
                  <span className="block text-[11px] text-muted-foreground truncate">{format(new Date(req.submittedAt), "MMM d, yyyy")}</span>
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
    </>
  );
}
