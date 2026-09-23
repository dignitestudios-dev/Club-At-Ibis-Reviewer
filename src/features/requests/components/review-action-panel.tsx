"use client";

import { useState } from "react";
import { AlertTriangle, ArrowRight, Ban, CheckCircle2, CheckCheck, FileEdit, Flag, Lock, PlayCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { useAcceptItems, useApproveRequest, useRejectRequest, useRequestRevision, useStartReview } from "@/hooks/use-reviewer-data";
import { useToast } from "@/hooks/use-toast";
import { reviewProgress } from "@/lib/domain";
import { formatDate } from "@/utils/format";

/** Two-colour progress: green for accepted items, amber for flagged ones. */
function Meter({ accepted, flagged, total }: { accepted: number; flagged: number; total: number }) {
  const pct = (n: number) => (total === 0 ? 0 : (n / total) * 100);
  return (
    <div
      className="flex h-2 w-full overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuenow={accepted + flagged}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label={`${accepted} accepted, ${flagged} flagged of ${total} items`}
    >
      <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${pct(accepted)}%` }} />
      <div className="h-full bg-amber-400 transition-all duration-500" style={{ width: `${pct(flagged)}%` }} />
    </div>
  );
}

/**
 * The reviewer's decision controls. Only the assigned reviewer sees actions;
 * once the request is Approved, revision and rejection are no longer offered.
 */
export function ReviewActionPanel({
  request,
  isOwner,
  onGoToCompletion,
}: {
  request: RequestRecord;
  isOwner: boolean;
  onGoToCompletion: () => void;
}) {
  const toast = useToast();
  const start = useStartReview();
  const acceptItems = useAcceptItems();
  const revise = useRequestRevision();
  const reject = useRejectRequest();
  const approve = useApproveRequest();

  const [revising, setRevising] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState("");

  const progress = reviewProgress(request);
  const reviewable = request.status === "under_review" || request.status === "resubmitted";
  const reviewed = progress.accepted.length + progress.flagged.length;
  const blockers: string[] = [];
  if (progress.flagged.length > 0) blockers.push(`${progress.flagged.length} flagged item${progress.flagged.length === 1 ? " needs" : "s need"} to be resolved or sent back`);
  if (progress.pending.length > 0) blockers.push(`${progress.pending.length} item${progress.pending.length === 1 ? " is" : "s are"} not reviewed yet`);
  const fail = (title: string) => (e: Error) => toast.error(title, e.message);

  function openRevision() {
    const lines = progress.flagged.map((f) => {
      const note = request.itemReviews[f.id]?.reason;
      return note ? `• ${f.label}: ${note}` : `• ${f.label}`;
    });
    setFeedback(`Please correct the flagged items below and resubmit.\n${lines.join("\n")}`);
    setError("");
    setRevising(true);
  }

  return (
    <Card className="shadow-2xs">
      <CardHeader className="border-b border-border/70 pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="font-heading text-lg font-medium">Review &amp; Decision</CardTitle>
          <StatusBadge status={request.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        {!isOwner && (
          <p className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            Only the assigned reviewer can review and decide this request. You can inspect it read-only.
          </p>
        )}

        {/* Submitted → start review */}
        {isOwner && request.status === "submitted" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Starting the review moves the request to <span className="font-semibold text-foreground">Under Review</span> so you can accept or flag each field and file.
            </p>
            <Button
              className="w-full"
              onClick={() => start.mutate(request.id, { onSuccess: () => toast.success("Review started", "The request is now Under Review."), onError: fail("Could not start review") })}
              disabled={start.isPending}
            >
              {start.isPending ? <Spinner className="size-4" /> : <PlayCircle />}
              Start review
            </Button>
          </div>
        )}

        {/* Under review / resubmitted */}
        {reviewable && (
          <div className="space-y-4">
            {request.status === "resubmitted" && (
              <p className="rounded-xl border border-purple-300/70 bg-purple-50 p-3 text-xs text-purple-950 dark:border-purple-800/70 dark:bg-purple-950/30 dark:text-purple-200">
                The resident corrected the flagged items. Review the items marked “Updated by resident”, then choose your next action.
              </p>
            )}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">
                  {reviewed} of {progress.items.length} items reviewed
                </span>
                <span className="inline-flex items-center gap-3 text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-emerald-500" />{progress.accepted.length} accepted</span>
                  <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-amber-400" />{progress.flagged.length} flagged</span>
                </span>
              </div>
              <Meter accepted={progress.accepted.length} flagged={progress.flagged.length} total={progress.items.length} />
            </div>

            {isOwner && (
              <>
                {progress.pending.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={acceptItems.isPending}
                    onClick={() =>
                      acceptItems.mutate(
                        { requestId: request.id, fieldIds: progress.pending.map((f) => f.id) },
                        { onSuccess: () => toast.success("Items accepted", `${progress.pending.length} remaining item${progress.pending.length === 1 ? "" : "s"} marked accepted.`), onError: fail("Could not save") }
                      )
                    }
                  >
                    {acceptItems.isPending ? <Spinner className="size-4" /> : <CheckCheck />}
                    Accept all {progress.pending.length} remaining
                  </Button>
                )}

                <div className="grid gap-2 border-t border-border/70 pt-4">
                  <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Choose next action</p>
                  <Button variant="outline" onClick={openRevision} disabled={progress.flagged.length === 0} className="justify-start">
                    <FileEdit />
                    Request revision
                  </Button>
                  <Button variant="outline" onClick={() => { setRejectReason(""); setError(""); setRejecting(true); }} className="justify-start text-destructive hover:text-destructive">
                    <XCircle />
                    Reject request
                  </Button>
                  <Button onClick={() => setApproving(true)} disabled={blockers.length > 0} className="justify-start">
                    <CheckCircle2 />
                    Approve request
                  </Button>
                  {progress.flagged.length === 0 && (
                    <p className="text-[11px] text-muted-foreground">Flag at least one item to request a revision.</p>
                  )}
                  {blockers.length > 0 && (
                    <p className="flex items-start gap-1.5 text-[11px] text-amber-800 dark:text-amber-300">
                      <AlertTriangle className="mt-px size-3 shrink-0" aria-hidden="true" />
                      Resolve outstanding review issues before approving: {blockers.join("; ")}.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {request.status === "changes_required" && (
          <div className="space-y-3">
            <p className="flex items-start gap-2 rounded-xl border border-amber-300/70 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800/70 dark:bg-amber-950/30 dark:text-amber-200">
              <Flag className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                Waiting for the resident. Only the {progress.flagged.length} flagged item{progress.flagged.length === 1 ? " is" : "s are"} editable, and there are no chat replies — the resident corrects and resubmits.
              </span>
            </p>
            {request.feedback && (
              <div className="rounded-xl border border-border bg-muted/30 p-3">
                <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Feedback sent</p>
                <p className="mt-1 text-sm whitespace-pre-line text-foreground">{request.feedback}</p>
              </div>
            )}
          </div>
        )}

        {request.status === "approved" && (
          <div className="space-y-3">
            <p className="flex items-start gap-2 rounded-xl border border-emerald-300/70 bg-emerald-50 p-3 text-sm text-emerald-950 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-200">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                Approved{request.decidedAt ? ` on ${formatDate(request.decidedAt)}` : ""}. Revision and rejection are no longer available.
              </span>
            </p>
            <Button className="w-full" onClick={onGoToCompletion}>
              Continue to deposit &amp; completion
              <ArrowRight />
            </Button>
          </div>
        )}

        {request.status === "completed" && (
          <p className="flex items-start gap-2 rounded-xl border border-teal-300/70 bg-teal-50 p-3 text-sm text-teal-950 dark:border-teal-900/70 dark:bg-teal-950/30 dark:text-teal-200">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>Completed{request.completedAt ? ` on ${formatDate(request.completedAt)}` : ""}. The final letter is with the resident.</span>
          </p>
        )}

        {request.status === "rejected" && (
          <div className="rounded-xl border border-rose-300/70 bg-rose-50 p-3 dark:border-rose-900/70 dark:bg-rose-950/30">
            <p className="flex items-center gap-2 text-sm font-semibold text-rose-950 dark:text-rose-200">
              <XCircle className="size-4" aria-hidden="true" /> Rejected
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-rose-900/90 dark:text-rose-300/90">{request.rejectionReason}</p>
          </div>
        )}

        {request.status === "withdrawn" && (
          <div className="space-y-3">
            <p className="flex items-start gap-2 rounded-xl border border-slate-300/80 bg-slate-50 p-3 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200">
              <Ban className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>Withdrawn by the resident. Review and completion actions are stopped.</span>
            </p>
            {request.deposit.status === "received" && (
              <Button variant={request.refund ? "outline" : "default"} className="w-full" onClick={onGoToCompletion}>
                {request.refund ? "View refund outcome" : "Record refund outcome"}
                <ArrowRight />
              </Button>
            )}
          </div>
        )}
      </CardContent>

      {/* Request revision */}
      <Dialog open={revising} onOpenChange={setRevising}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-medium">Request Revision</DialogTitle>
            <DialogDescription>
              The status becomes <span className="font-semibold text-foreground">Changes Required</span> and the resident is notified. Only the {progress.flagged.length} flagged item{progress.flagged.length === 1 ? " becomes" : "s become"} editable.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <ul className="flex flex-wrap gap-1.5">
              {progress.flagged.map((f) => (
                <li key={f.id} className="inline-flex items-center gap-1 rounded-full border border-amber-300/80 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                  <Flag className="size-3" aria-hidden="true" />
                  {f.label}
                </li>
              ))}
            </ul>
            <label htmlFor="revision-feedback" className="block text-sm font-medium text-foreground">
              Feedback to the resident <span className="text-destructive">*</span> <span className="font-normal text-muted-foreground">(required)</span>
            </label>
            <Textarea id="revision-feedback" rows={6} value={feedback} onChange={(e) => { setFeedback(e.target.value); setError(""); }} aria-invalid={!!error} className="resize-none" />
            {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevising(false)}>
              Cancel
            </Button>
            <Button
              disabled={revise.isPending}
              onClick={() => {
                if (!feedback.trim()) return setError("Feedback is required — tell the resident what to correct.");
                revise.mutate(
                  { requestId: request.id, feedback },
                  {
                    onSuccess: () => {
                      setRevising(false);
                      toast.success("Revision requested", "The resident has been notified to correct the flagged items.");
                    },
                    onError: fail("Could not request revision"),
                  }
                );
              }}
            >
              {revise.isPending && <Spinner className="size-4" />}
              Send Revision Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject */}
      <Dialog open={rejecting} onOpenChange={setRejecting}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-medium">Reject Request</DialogTitle>
            <DialogDescription>
              The request becomes <span className="font-semibold text-foreground">Rejected</span> and the resident is notified with your reason. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="reject-reason" className="block text-sm font-medium text-foreground">
              Rejection reason <span className="text-destructive">*</span>
            </label>
            <Textarea
              id="reject-reason"
              rows={5}
              value={rejectReason}
              onChange={(e) => { setRejectReason(e.target.value); setError(""); }}
              placeholder="State the guideline or condition the request does not meet."
              aria-invalid={!!error}
              className="resize-none"
            />
            {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={reject.isPending}
              onClick={() => {
                if (!rejectReason.trim()) return setError("A rejection reason is required.");
                reject.mutate(
                  { requestId: request.id, reason: rejectReason },
                  {
                    onSuccess: () => {
                      setRejecting(false);
                      toast.success("Request rejected", "The resident has been notified.");
                    },
                    onError: fail("Could not reject"),
                  }
                );
              }}
            >
              {reject.isPending && <Spinner className="size-4" />}
              Confirm rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve */}
      <ConfirmDialog
        open={approving}
        onOpenChange={setApproving}
        title="Approve this request?"
        description="The status becomes Approved and the resident is notified. After approval, revision and rejection are no longer available — you'll continue with the deposit and final letter."
        confirmLabel="Approve request"
        loading={approve.isPending}
        onConfirm={() =>
          approve.mutate(request.id, {
            onSuccess: () => {
              toast.success("Request approved", "The resident has been notified. Continue with deposit and completion.");
              onGoToCompletion();
            },
            onError: fail("Could not approve"),
          })
        }
      />
    </Card>
  );
}
