import { currentReviewer, db, delay, pushNotification } from "@/lib/mock/store";
import { IN_FLIGHT, currentSubmissionAt, currentSubmissionNumber, reviewProgress, residentFullName } from "@/lib/domain";

/* ------------------------------------------------------------------ */
/* helpers                                                              */
/* ------------------------------------------------------------------ */

const REVIEWABLE: RequestStatus[] = ["under_review", "resubmitted"];

function load(requestId: string) {
  const requests = db.getRequests();
  const idx = requests.findIndex((r) => r.id === requestId);
  if (idx === -1) throw new Error("Request not found.");
  return { requests, idx, request: requests[idx] };
}

/** Only the reviewer a request is assigned to may act on it. */
function loadOwned(requestId: string) {
  const me = currentReviewer();
  const ctx = load(requestId);
  if (ctx.request.assignedReviewerId !== me.id) {
    throw new Error("This request is not assigned to you, so you cannot act on it.");
  }
  return { ...ctx, me };
}

function event(me: Reviewer, type: HistoryEventType, message: string, extra: Partial<Pick<HistoryEvent, "detail" | "staffOnly" | "assignment">> = {}): HistoryEvent {
  return {
    id: crypto.randomUUID(),
    type,
    actor: { name: me.name, role: "reviewer" },
    message,
    createdAt: new Date().toISOString(),
    ...extra,
  };
}

function commit(requests: RequestRecord[], idx: number, next: RequestRecord, events: HistoryEvent[] = []) {
  const updated: RequestRecord = {
    ...next,
    updatedAt: events[events.length - 1]?.createdAt ?? new Date().toISOString(),
    history: [...next.history, ...events],
  };
  const list = [...requests];
  list[idx] = updated;
  db.setRequests(list);
  return updated;
}

function toAttached(file: { name: string; size: number }, at: string): AttachedFile {
  return { id: crypto.randomUUID(), name: file.name, size: file.size, uploadedAt: at };
}

function label(request: RequestRecord, fieldId: string) {
  return request.formSnapshot.find((f) => f.id === fieldId)?.label ?? "item";
}

function residentEmail(request: RequestRecord) {
  return db.getResidents().find((r) => r.id === request.residentId)?.email ?? "the resident";
}

/* ------------------------------------------------------------------ */
/* Review                                                               */
/* ------------------------------------------------------------------ */

export async function startReview(requestId: string): Promise<RequestRecord> {
  const { requests, idx, request, me } = loadOwned(requestId);
  if (request.status !== "submitted") throw new Error("Review can only be started on a newly submitted request.");
  const updated = commit(requests, idx, { ...request, status: "under_review" }, [
    event(me, "review_started", "Review started — status changed to Under Review."),
  ]);
  return delay(updated, 200);
}

export interface ReviewItemPayload {
  requestId: string;
  fieldId: string;
  state: "accepted" | "flagged";
  reason?: string;
}

export async function reviewItem({ requestId, fieldId, state, reason }: ReviewItemPayload): Promise<RequestRecord> {
  const { requests, idx, request, me } = loadOwned(requestId);
  if (!REVIEWABLE.includes(request.status)) throw new Error("Items can only be reviewed while the request is under review.");
  const trimmed = reason?.trim() || undefined;
  const item = label(request, fieldId);
  const review: ItemReview = state === "flagged" ? { state, reason: trimmed } : { state };
  const updated = commit(
    requests,
    idx,
    { ...request, itemReviews: { ...request.itemReviews, [fieldId]: review } },
    [
      state === "flagged"
        ? event(me, "item_flagged", `Flagged “${item}”.`, { detail: trimmed })
        : event(me, "item_accepted", `Accepted “${item}”.`),
    ]
  );
  return delay(updated, 120);
}

export async function acceptItems({ requestId, fieldIds }: { requestId: string; fieldIds: string[] }): Promise<RequestRecord> {
  const { requests, idx, request, me } = loadOwned(requestId);
  if (!REVIEWABLE.includes(request.status)) throw new Error("Items can only be reviewed while the request is under review.");
  if (fieldIds.length === 0) throw new Error("Nothing to accept.");
  const itemReviews = { ...request.itemReviews };
  fieldIds.forEach((id) => (itemReviews[id] = { state: "accepted" }));
  const updated = commit(requests, idx, { ...request, itemReviews }, [
    event(me, "item_accepted", `Accepted ${fieldIds.length} item${fieldIds.length === 1 ? "" : "s"} as complete.`),
  ]);
  return delay(updated, 160);
}

export async function requestRevision({ requestId, feedback }: { requestId: string; feedback: string }): Promise<RequestRecord> {
  const { requests, idx, request, me } = loadOwned(requestId);
  if (!REVIEWABLE.includes(request.status)) throw new Error("A revision can only be requested while the request is under review.");
  const flagged = Object.entries(request.itemReviews).filter(([, r]) => r.state === "flagged");
  if (flagged.length === 0) throw new Error("Flag at least one item before requesting a revision.");
  if (!feedback.trim()) throw new Error("Feedback for the resident is required.");
  // Retain the submission exactly as reviewed, so it stays available after the resident resubmits.
  const number = currentSubmissionNumber(request);
  const snapshot: SubmissionSnapshot = {
    id: crypto.randomUUID(),
    number,
    submittedAt: currentSubmissionAt(request),
    reviewedAt: new Date().toISOString(),
    fieldValues: { ...request.fieldValues },
    uploads: { ...request.uploads },
    itemReviews: { ...request.itemReviews },
    feedback: feedback.trim(),
  };
  const kept = (request.previousSubmissions ?? []).filter((x) => x.number !== number);
  const updated = commit(
    requests,
    idx,
    { ...request, status: "changes_required", feedback: feedback.trim(), previousSubmissions: [...kept, snapshot] },
    [
      event(me, "revision_requested", `Revision requested — ${flagged.length} flagged item${flagged.length === 1 ? "" : "s"}.`, {
        detail: `${feedback.trim()} Flagged: ${flagged.map(([id]) => label(request, id)).join(", ")}. Resident notified through the portal and by email.`,
      }),
    ]
  );
  return delay(updated, 240);
}

export async function rejectRequest({ requestId, reason }: { requestId: string; reason: string }): Promise<RequestRecord> {
  const { requests, idx, request, me } = loadOwned(requestId);
  if (!REVIEWABLE.includes(request.status)) throw new Error("A request can only be rejected while it is under review.");
  if (!reason.trim()) throw new Error("A rejection reason is required.");
  const now = new Date().toISOString();
  const updated = commit(
    requests,
    idx,
    { ...request, status: "rejected", rejectionReason: reason.trim(), decidedAt: now },
    [event(me, "rejected", "Request rejected.", { detail: `${reason.trim()} Resident notified through the portal and by email.` })]
  );
  return delay(updated, 240);
}

export async function approveRequest(requestId: string): Promise<RequestRecord> {
  const { requests, idx, request, me } = loadOwned(requestId);
  if (!REVIEWABLE.includes(request.status)) throw new Error("A request can only be approved while it is under review.");
  const progress = reviewProgress(request);
  if (progress.flagged.length > 0) throw new Error("Resolve the flagged items before approving.");
  if (progress.pending.length > 0) throw new Error(`Review the remaining ${progress.pending.length} item${progress.pending.length === 1 ? "" : "s"} before approving.`);
  const now = new Date().toISOString();
  const updated = commit(requests, idx, { ...request, status: "approved", decidedAt: now, feedback: undefined }, [
    event(me, "approved", "Request approved.", { detail: "Resident notified through the portal and by email." }),
  ]);
  return delay(updated, 240);
}

/* ------------------------------------------------------------------ */
/* Deposit and completion                                               */
/* ------------------------------------------------------------------ */

export async function setDeposit({ requestId, required, amount }: { requestId: string; required: boolean; amount?: number }): Promise<RequestRecord> {
  const { requests, idx, request, me } = loadOwned(requestId);
  if (request.status !== "approved") throw new Error("Deposit can only be set on an approved request.");
  if (request.deposit.status === "received") throw new Error("A deposit has already been received and cannot be changed.");
  if (!required) {
    const updated = commit(requests, idx, { ...request, deposit: { required: false, status: "not_required", confirmed: true } }, [
      event(me, "deposit_required", "Deposit not required for this request."),
    ]);
    return delay(updated, 160);
  }
  if (!amount || amount <= 0) throw new Error("Enter a deposit amount greater than zero.");
  const updated = commit(
    requests,
    idx,
    { ...request, deposit: { required: true, amount, status: "pending", confirmed: true } },
    [event(me, "deposit_required", `Deposit of $${amount.toLocaleString()} required — status Pending.`, { detail: "Payment is made outside the application.", staffOnly: true })]
  );
  return delay(updated, 160);
}

export async function recordReceipt({ requestId, file }: { requestId: string; file?: { name: string; size: number } | null }): Promise<RequestRecord> {
  const { requests, idx, request, me } = loadOwned(requestId);
  if (request.status !== "approved" || !request.deposit.required) throw new Error("There is no pending deposit on this request.");
  if (request.deposit.status === "received") throw new Error("The deposit is already marked as received.");
  const now = new Date().toISOString();
  const receipt: AttachedFile | undefined = file ? { id: crypto.randomUUID(), name: file.name, size: file.size, uploadedAt: now } : undefined;
  const updated = commit(
    requests,
    idx,
    { ...request, deposit: { ...request.deposit, status: "received", receipt, receivedAt: now } },
    [event(me, "receipt_recorded", file ? "Deposit received — payment proof uploaded." : "Deposit marked as received.", { detail: `${file ? `${file.name} · ` : ""}${request.deposit.amount?.toLocaleString()}`, staffOnly: true })]
  );
  return delay(updated, 220);
}

export async function uploadLetter({ requestId, file }: { requestId: string; file: { name: string; size: number } }): Promise<RequestRecord> {
  const { requests, idx, request, me } = loadOwned(requestId);
  if (request.status !== "approved") throw new Error("The final letter can only be uploaded on an approved request.");
  const letter: AttachedFile = { id: crypto.randomUUID(), name: file.name, size: file.size, uploadedAt: new Date().toISOString() };
  const updated = commit(requests, idx, { ...request, approvalLetter: letter }, [
    event(me, "letter_uploaded", request.approvalLetter ? "Final approval letter replaced." : "Final approval letter uploaded.", { detail: file.name }),
  ]);
  return delay(updated, 220);
}

/** What is still missing before a request can be marked Completed. */
export function completionGaps(request: RequestRecord): string[] {
  const gaps: string[] = [];
  const decided = request.deposit.required || request.deposit.confirmed;
  if (!decided) gaps.push("Set whether a deposit is required");
  if (request.deposit.required && request.deposit.status !== "received") gaps.push("Mark the deposit as received");
  if (!request.approvalLetter) gaps.push("Upload the final approval letter");
  return gaps;
}

export async function completeRequest(requestId: string): Promise<RequestRecord> {
  const { requests, idx, request, me } = loadOwned(requestId);
  if (request.status !== "approved") throw new Error("Only an approved request can be completed.");
  const gaps = completionGaps(request);
  if (gaps.length > 0) throw new Error(`Cannot complete yet — ${gaps.map((g) => g.toLowerCase()).join("; ")}.`);
  const now = new Date().toISOString();
  const email = residentEmail(request);
  const updated = commit(
    requests,
    idx,
    { ...request, status: "completed", completedAt: now, letterEmail: { status: "sent", at: now } },
    [
      event(me, "completed", "Request marked Completed."),
      {
        id: crypto.randomUUID(),
        type: "letter_email",
        actor: { name: "System", role: "system" },
        message: `Approval letter emailed to ${email}.`,
        detail: "The letter is also available in the resident portal.",
        createdAt: now,
      },
    ]
  );
  return delay(updated, 320);
}

/** Sends the approval-letter email to the resident again. The request stays Completed. */
export async function resendApprovalEmail(requestId: string): Promise<RequestRecord> {
  const { requests, idx, request, me } = loadOwned(requestId);
  if (request.status !== "completed") throw new Error("The approval email can only be resent on a completed request.");
  if (!request.approvalLetter) throw new Error("There is no approval letter to send.");
  const now = new Date().toISOString();
  const email = residentEmail(request);
  const updated = commit(requests, idx, { ...request, letterEmail: { status: "sent", at: now } }, [
    {
      id: crypto.randomUUID(),
      type: "letter_email",
      actor: { name: me.name, role: "reviewer" },
      message: `Approval letter email resent to ${email}.`,
      detail: request.approvalLetter.name,
      createdAt: now,
    },
  ]);
  return delay(updated, 320);
}

/* ------------------------------------------------------------------ */
/* Withdrawal and refund                                                */
/* ------------------------------------------------------------------ */

export async function recordRefundOutcome({ requestId, outcome, proof }: { requestId: string; outcome: "awaiting" | "no_refund"; proof?: { name: string; size: number } | null }): Promise<RequestRecord> {
  const { requests, idx, request, me } = loadOwned(requestId);
  if (request.status !== "withdrawn") throw new Error("A refund outcome can only be recorded on a withdrawn request.");
  if (request.deposit.status !== "received") throw new Error("No deposit was received, so no refund action is needed.");
  if (request.refund) throw new Error("A refund outcome has already been recorded.");
  const now = new Date().toISOString();
  const notified = "Resident notified through the portal and by email.";
  const attached = proof ? toAttached(proof, now) : undefined;
  const proofNote = attached ? ` Proof attached: ${attached.name}.` : "";
  const updated = commit(requests, idx, { ...request, refund: { outcome, recordedBy: me.name, date: now, proof: attached } }, [
    outcome === "awaiting"
      ? event(me, "refund_awaiting", "Refund to be made — awaiting refund action.", { detail: `The refund happens outside the app.${proofNote} ${notified}` })
      : event(me, "no_refund", "Recorded No Refund for the deposit.", { detail: `Refund not applicable / not agreed.${proofNote} ${notified}` }),
  ]);
  return delay(updated, 220);
}

export async function markRefunded({ requestId, proof }: { requestId: string; proof?: { name: string; size: number } | null }): Promise<RequestRecord> {
  const { requests, idx, request, me } = loadOwned(requestId);
  if (request.refund?.outcome !== "awaiting") throw new Error("This request is not awaiting a refund.");
  const now = new Date().toISOString();
  const attached = proof ? toAttached(proof, now) : request.refund.proof;
  const updated = commit(requests, idx, { ...request, refund: { outcome: "refunded", recordedBy: me.name, date: now, proof: attached } }, [
    event(me, "refunded", "Deposit marked Refunded.", { detail: `${proof ? `Proof attached: ${proof.name}. ` : ""}Resident notified through the portal and by email.` }),
  ]);
  return delay(updated, 220);
}

/* ------------------------------------------------------------------ */
/* Routing (default reviewers only)                                     */
/* ------------------------------------------------------------------ */

export async function assignRequest({ requestId, reviewerId }: { requestId: string; reviewerId: string }): Promise<RequestRecord> {
  const me = currentReviewer();
  if (!me.receiveNewRequests) throw new Error("Only default reviewers can assign or reassign requests.");
  const { requests, idx, request } = load(requestId);
  if (!IN_FLIGHT.includes(request.status)) throw new Error("Only requests that are still in progress can be assigned.");
  const reviewers = db.getReviewers();
  const target = reviewers.find((r) => r.id === reviewerId);
  if (!target) throw new Error("Reviewer not found.");
  if (!target.loginEnabled) throw new Error("Inactive reviewers cannot be assigned requests.");
  if (request.assignedReviewerId === reviewerId) throw new Error(`${target.name} is already assigned to this request.`);

  const previous = request.assignedReviewerId ? reviewers.find((r) => r.id === request.assignedReviewerId) : undefined;
  const takingOwnership = !previous && target.id === me.id;
  const message = previous
    ? `Reassigned from ${previous.name} to ${target.name}.`
    : takingOwnership
      ? `${me.name} took ownership of this request.`
      : `${me.name} assigned this request to ${target.name}.`;

  const updated = commit(requests, idx, { ...request, assignedReviewerId: target.id }, [
    event(me, previous ? "reassigned" : "assigned", message, {
      detail: previous ? `${previous.name} no longer has authority to act on this request.` : undefined,
      assignment: { from: previous?.name, to: target.name },
    }),
  ]);

  const who = residentFullName(db.getResidents().find((r) => r.id === request.residentId));
  if (target.id !== me.id) {
    pushNotification({
      reviewerId: target.id,
      type: "new_assignment",
      title: previous ? "Request reassigned to you" : "New assignment",
      message: `${request.code} · ${request.categoryName} for ${who} was assigned to you by ${me.name}.`,
      requestId: request.id,
    });
  }
  if (previous && previous.id !== me.id) {
    pushNotification({
      reviewerId: previous.id,
      type: "request_update",
      title: "Request reassigned",
      message: `${request.code} was reassigned to ${target.name} by ${me.name}. You no longer own this request.`,
      requestId: request.id,
    });
  }
  return delay(updated, 220);
}
