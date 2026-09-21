/* ------------------------------------------------------------------ */
/* Status metadata                                                     */
/* ------------------------------------------------------------------ */

export const STATUS_ORDER: RequestStatus[] = [
  "submitted",
  "under_review",
  "changes_required",
  "resubmitted",
  "approved",
  "rejected",
  "completed",
  "withdrawn",
];

export const STATUS_LABEL: Record<RequestStatus, string> = {
  submitted: "Submitted",
  under_review: "Under Review",
  changes_required: "Changes Required",
  resubmitted: "Resubmitted",
  approved: "Approved",
  rejected: "Rejected",
  completed: "Completed",
  withdrawn: "Withdrawn",
};

/** Hex colours for charts — mirrors the status badge palette. */
export const STATUS_COLOR: Record<RequestStatus, string> = {
  submitted: "#64748b",
  under_review: "#0284c7",
  changes_required: "#d97706",
  resubmitted: "#9333ea",
  approved: "#059669",
  rejected: "#e11d48",
  completed: "#0f766e",
  withdrawn: "#94a3b8",
};

/** Requests still moving through the workflow. */
export const IN_FLIGHT: RequestStatus[] = ["submitted", "under_review", "changes_required", "resubmitted", "approved"];

export const DEPOSIT_LABEL: Record<DepositStatus, string> = {
  not_required: "Not required",
  pending: "Pending",
  received: "Received",
};

export const REFUND_LABEL: Record<RefundOutcome, string> = {
  awaiting: "Awaiting refund action",
  refunded: "Refunded",
  no_refund: "No Refund",
};

/* ------------------------------------------------------------------ */
/* People                                                              */
/* ------------------------------------------------------------------ */

export function residentFullName(r?: Pick<Resident, "firstName" | "lastName"> | null) {
  return r ? `${r.firstName} ${r.lastName}`.trim() : "Unknown resident";
}

export function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

/* ------------------------------------------------------------------ */
/* Request filtering                                                   */
/* ------------------------------------------------------------------ */

export interface RequestFilters {
  search: string;
  status: RequestStatus | "all";
  categoryId: string;
  categoryStatus: "all" | CategoryStatus;
  reviewerId: string; // "all" | "unassigned" | reviewer id
  depositStatus: "all" | DepositStatus;
  refund: "all" | RefundOutcome | "none";
  year: string; // "all" | "2026"
  from: string; // yyyy-mm-dd
  to: string;
}

export const DEFAULT_FILTERS: RequestFilters = {
  search: "",
  status: "all",
  categoryId: "all",
  categoryStatus: "all",
  reviewerId: "all",
  depositStatus: "all",
  refund: "all",
  year: "all",
  from: "",
  to: "",
};

interface FilterContext {
  residents: Resident[];
  categories: Category[];
}

export function filterRequests(
  requests: RequestRecord[],
  filters: RequestFilters,
  ctx: FilterContext
): RequestRecord[] {
  const q = filters.search.trim().toLowerCase();
  const residentById = new Map(ctx.residents.map((r) => [r.id, r]));
  const categoryById = new Map(ctx.categories.map((c) => [c.id, c]));

  return requests.filter((req) => {
    if (q) {
      const resident = residentById.get(req.residentId);
      const hay = [
        req.code,
        residentFullName(resident),
        resident?.residentIdNumber,
        req.fieldValues.propertyAddress,
        req.fieldValues.lotNo,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (filters.status !== "all" && req.status !== filters.status) return false;
    if (filters.categoryId !== "all" && req.categoryId !== filters.categoryId) return false;
    if (filters.categoryStatus !== "all") {
      const cat = categoryById.get(req.categoryId);
      if ((cat?.status ?? "active") !== filters.categoryStatus) return false;
    }
    if (filters.reviewerId === "unassigned") {
      if (req.assignedReviewerId) return false;
    } else if (filters.reviewerId !== "all" && req.assignedReviewerId !== filters.reviewerId) {
      return false;
    }
    if (filters.depositStatus !== "all" && req.deposit.status !== filters.depositStatus) return false;
    if (filters.refund !== "all") {
      if (filters.refund === "none") {
        if (req.refund) return false;
      } else if (req.refund?.outcome !== filters.refund) {
        return false;
      }
    }
    if (filters.year !== "all" && new Date(req.submittedAt).getFullYear().toString() !== filters.year) return false;
    if (filters.from && req.submittedAt.slice(0, 10) < filters.from) return false;
    if (filters.to && req.submittedAt.slice(0, 10) > filters.to) return false;
    return true;
  });
}

export function countActiveFilters(filters: RequestFilters): number {
  let n = 0;
  (Object.keys(DEFAULT_FILTERS) as (keyof RequestFilters)[]).forEach((k) => {
    if (k !== "search" && filters[k] !== DEFAULT_FILTERS[k]) n += 1;
  });
  return n;
}

/* ------------------------------------------------------------------ */
/* Ownership & review helpers                                          */
/* ------------------------------------------------------------------ */

export function isDefaultReviewer(reviewer?: Pick<Reviewer, "receiveNewRequests" | "loginEnabled"> | null) {
  return !!reviewer && reviewer.receiveNewRequests && reviewer.loginEnabled;
}

/** Waiting in the default reviewers' incoming list. */
export function isIncoming(req: RequestRecord) {
  return req.status === "submitted" && !req.assignedReviewerId;
}

/** Fields and files the resident actually provided — the reviewer inspects each one. */
export function reviewItems(req: RequestRecord): CategoryField[] {
  return [...req.formSnapshot]
    .sort((a, b) => a.order - b.order)
    .filter((f) => (f.type === "file" ? (req.uploads[f.id]?.length ?? 0) > 0 : !!req.fieldValues[f.id]?.toString().trim()));
}

export function reviewProgress(req: RequestRecord) {
  const items = reviewItems(req);
  const accepted = items.filter((f) => req.itemReviews[f.id]?.state === "accepted");
  const flagged = items.filter((f) => req.itemReviews[f.id]?.state === "flagged");
  const pending = items.filter((f) => !req.itemReviews[f.id]);
  return { items, accepted, flagged, pending };
}

/** Fields the resident changed while resubmitting. */
export function changedFieldIds(req: RequestRecord): Set<string> {
  return new Set(req.revisions.map((r) => r.fieldId));
}

export function depositDecided(deposit: DepositRecord) {
  return deposit.required || !!deposit.confirmed;
}

/** Withdrawn with a received deposit but no refund outcome recorded yet. */
export function needsRefundOutcome(req: RequestRecord) {
  return req.status === "withdrawn" && req.deposit.status === "received" && !req.refund;
}

/** Everything that needs this reviewer to act, grouped for the dashboard. */
export function attentionFor(requests: RequestRecord[], reviewerId: string) {
  const mine = requests.filter((r) => r.assignedReviewerId === reviewerId);
  return {
    mine,
    toStart: mine.filter((r) => r.status === "submitted"),
    resubmitted: mine.filter((r) => r.status === "resubmitted"),
    underReview: mine.filter((r) => r.status === "under_review"),
    waitingOnResident: mine.filter((r) => r.status === "changes_required"),
    toComplete: mine.filter((r) => r.status === "approved"),
    refunds: mine.filter((r) => needsRefundOutcome(r) || r.refund?.outcome === "awaiting"),
  };
}

/* ------------------------------------------------------------------ */
/* "What happens next" — shown on the reviewer's lists                   */
/* ------------------------------------------------------------------ */

export type NextTone = "action" | "waiting" | "done";

export function nextStep(req: RequestRecord): { label: string; tone: NextTone } {
  const progress = reviewProgress(req);
  switch (req.status) {
    case "submitted":
      return req.assignedReviewerId ? { label: "Start review", tone: "action" } : { label: "Waiting for an owner", tone: "waiting" };
    case "under_review":
      return progress.flagged.length > 0
        ? { label: `${progress.flagged.length} flagged · decide next step`, tone: "action" }
        : { label: progress.pending.length > 0 ? `${progress.pending.length} item${progress.pending.length === 1 ? "" : "s"} to review` : "Ready to decide", tone: "action" };
    case "changes_required":
      return { label: "Waiting for resident", tone: "waiting" };
    case "resubmitted":
      return { label: "Review resubmitted items", tone: "action" };
    case "approved": {
      if (!depositDecided(req.deposit)) return { label: "Set deposit requirement", tone: "action" };
      if (req.deposit.required && req.deposit.status !== "received") return { label: "Awaiting deposit receipt", tone: "action" };
      if (!req.approvalLetter) return { label: "Upload final letter", tone: "action" };
      return { label: "Ready to mark Completed", tone: "action" };
    }
    case "completed":
      return { label: "Completed", tone: "done" };
    case "rejected":
      return { label: "Closed · rejected", tone: "done" };
    case "withdrawn":
      if (needsRefundOutcome(req)) return { label: "Record refund outcome", tone: "action" };
      if (req.refund?.outcome === "awaiting") return { label: "Refund to be made", tone: "action" };
      return { label: "Closed · withdrawn", tone: "done" };
  }
}

/* ------------------------------------------------------------------ */
/* Submissions                                                         */
/* ------------------------------------------------------------------ */

/** 1 for the original submission, +1 for every resubmission. */
export function currentSubmissionNumber(req: RequestRecord) {
  return Math.max(1, req.history.filter((e) => e.type === "submitted" || e.type === "resubmitted").length);
}

/** When the resident's latest submission arrived. */
export function currentSubmissionAt(req: RequestRecord) {
  const events = req.history.filter((e) => e.type === "submitted" || e.type === "resubmitted");
  return events.length ? events[events.length - 1].createdAt : req.submittedAt;
}

/** Earlier submissions the resident has since replaced, newest first. */
export function earlierSubmissions(req: RequestRecord): SubmissionSnapshot[] {
  const current = currentSubmissionNumber(req);
  return (req.previousSubmissions ?? []).filter((s) => s.number < current).sort((a, b) => b.number - a.number);
}
