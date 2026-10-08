"use client";

import { useCloseOnConflict } from "@/hooks/use-close-on-conflict";
import { ExpandableText } from "@/components/shared/expandable-text";
import { useEffect, useState, useRef, useMemo } from "react";
import { AlertTriangle, CheckCircle2, FileEdit, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { DepositFields, validateDeposit, type DepositValue } from "./deposit-fields";

/* ------------------------------------------------------------------ */
/* Approve Dialog                                                     */
/* ------------------------------------------------------------------ */

export function ApproveRequestDialog({
  request,
  open,
  onOpenChange,
  onConfirm,
  isPending = false,
}: {
  request: RequestRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Receives the deposit decision made in this dialog; the caller approves, then saves the deposit. */
  onConfirm: (deposit: DepositValue) => Promise<void> | void;
  isPending?: boolean;
}) {
  useCloseOnConflict(open, () => onOpenChange(false));
  const isSubmittingRef = useRef(false);
  const [deposit, setDeposit] = useState<DepositValue>({ required: false, amount: "" });
  const [depositError, setDepositError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDeposit({ required: false, amount: "" });
      setDepositError(null);
    }
  }, [open]);

  const flaggedFieldCount = Object.values(request.itemReviews || {}).filter((r) => r.state === "flagged").length;
  const flaggedFileCount = Object.values(request.fileItemReviews || {}).filter((r) => r.state === "flagged").length;
  const flaggedCount = (request.review?.items || []).length > 0
    ? (request.review?.items || []).filter((it) => it.decision === "flagged").length
    : flaggedFieldCount + flaggedFileCount;

  async function handleConfirm() {
    if (isSubmittingRef.current || isPending || flaggedCount > 0) return;
    const problem = validateDeposit(deposit);
    if (problem) {
      setDepositError(problem);
      return;
    }
    isSubmittingRef.current = true;
    try {
      await onConfirm(deposit);
      onOpenChange(false);
    } finally {
      isSubmittingRef.current = false;
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg w-full max-w-[calc(100vw-2rem)] max-h-[92svh] overflow-y-auto">
        <DialogHeader className="min-w-0">
          <div className="mb-1 flex size-10 items-center justify-center rounded-xl border border-emerald-300/80 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
            <CheckCircle2 className="size-5" aria-hidden="true" />
          </div>
          <DialogTitle className="font-heading text-xl font-medium break-words [overflow-wrap:anywhere]">Approve Request</DialogTitle>
          <DialogDescription className="break-words [overflow-wrap:anywhere]">
            Are you sure you want to approve request{" "}
            <span className="font-mono font-semibold text-foreground break-all">{request.code}</span>?
          </DialogDescription>
        </DialogHeader>

        {flaggedCount > 0 ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3.5 text-xs text-destructive min-w-0 break-words [overflow-wrap:anywhere]">
            <p className="font-medium">
              This request has {flaggedCount} flagged item{flaggedCount === 1 ? "" : "s"} requiring correction. Clear all flags or click &ldquo;Request Revision&rdquo; instead.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-3.5 text-xs text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300 min-w-0 break-words [overflow-wrap:anywhere]">
              <p className="font-medium">All form fields and submitted materials will be marked as accepted.</p>
              <p className="mt-1 text-muted-foreground">The resident will be notified that their request has been approved.</p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Security deposit</p>
              <DepositFields
                value={deposit}
                onChange={(v) => {
                  setDeposit(v);
                  setDepositError(null);
                }}
                error={depositError}
                disabled={isPending}
              />
            </div>

            <p className="text-xs text-muted-foreground">
              After approving you&apos;ll finish up in one place: attach the deposit receipt (if required), upload the final approval letter, then complete the request.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-600 dark:hover:bg-emerald-700"
            onClick={handleConfirm}
            disabled={isPending || flaggedCount > 0}
          >
            {isPending ? <Spinner className="size-4 mr-2" /> : <CheckCircle2 className="size-4 mr-2" />}
            Confirm Approval
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Request Revision Dialog                                            */
/* ------------------------------------------------------------------ */

export function RequestRevisionDialog({
  request,
  open,
  onOpenChange,
  onConfirm,
  isPending = false,
}: {
  request: RequestRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (feedback: string) => Promise<void> | void;
  isPending?: boolean;
}) {
  useCloseOnConflict(open, () => onOpenChange(false));
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (open) {
      setFeedback("");
      setError(null);
      isSubmittingRef.current = false;
    }
  }, [open]);

  const flaggedItems = useMemo(() => {
    if (request.review?.items && request.review.items.length > 0) {
      return request.review.items
        .filter((it) => it.decision === "flagged")
        .map((it) => {
          if (it.kind === "file" && it.fileId) {
            let fileName = "";
            for (const files of Object.values(request.uploads || {})) {
              const found = files.find((f) => f.id === it.fileId);
              if (found) {
                fileName = found.name;
                break;
              }
            }
            return {
              id: it.key || `file:${it.fileId}`,
              label: fileName ? `Document: ${fileName}` : it.label || "Uploaded Document",
              reason: it.reason || "",
            };
          }
          const field = (request.formSnapshot || []).find((f: CategoryField) => f.id === it.fieldId);
          return {
            id: it.key || `field:${it.fieldId}`,
            label: field?.label || it.label || it.fieldId,
            reason: it.reason || "",
          };
        });
    }

    const fieldFlags = (request.formSnapshot || [])
      .filter((f: CategoryField) => request.itemReviews?.[f.id]?.state === "flagged")
      .map((f: CategoryField) => ({
        id: f.id,
        label: f.label,
        reason: request.itemReviews[f.id]?.reason || "",
      }));

    const fileFlags = Object.entries(request.uploads || {}).flatMap(([fieldId, files]) =>
      files
        .filter((file) => request.fileItemReviews?.[file.id]?.state === "flagged")
        .map((file) => ({
          id: file.id,
          label: `Document: ${file.name}`,
          reason: request.fileItemReviews?.[file.id]?.reason || "",
        }))
    );

    return [...fieldFlags, ...fileFlags];
  }, [request]);

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (isSubmittingRef.current || isPending) return;

    const trimmed = feedback.trim();
    if (!trimmed) {
      setError("Please provide instructions or feedback for the requested revision.");
      return;
    }

    isSubmittingRef.current = true;
    try {
      await onConfirm(trimmed);
      onOpenChange(false);
    } finally {
      isSubmittingRef.current = false;
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg w-full max-w-[calc(100vw-2rem)]">
        <form onSubmit={handleSubmit} className="space-y-4 min-w-0">
          <DialogHeader className="min-w-0">
            <div className="mb-1 flex size-10 items-center justify-center rounded-xl border border-amber-300/80 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
              <FileEdit className="size-5" aria-hidden="true" />
            </div>
            <DialogTitle className="font-heading text-xl font-medium break-words [overflow-wrap:anywhere]">Request Corrections</DialogTitle>
            <DialogDescription className="break-words [overflow-wrap:anywhere]">
              The resident will be asked to update{" "}
              <span className="font-semibold text-foreground">
                {flaggedItems.length} flagged item{flaggedItems.length === 1 ? "" : "s"}
              </span>{" "}
              for <span className="font-mono font-semibold text-foreground break-all">{request.code}</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 min-w-0">
            <label
              htmlFor="revision-feedback-input"
              className="text-xs font-semibold tracking-wider text-muted-foreground uppercase"
            >
              Revision Feedback &amp; Instructions <span className="text-destructive">*</span>
            </label>
            <Textarea
              id="revision-feedback-input"
              value={feedback}
              onChange={(e) => {
                setFeedback(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Your request needs changes. See each flagged item for details."
              rows={3}
              maxLength={2000}
              disabled={isPending}
              className="resize-none break-words [overflow-wrap:anywhere]"
              autoFocus
            />
            <div className="flex justify-between text-[11px] text-muted-foreground">
              {error ? <span className="font-medium text-destructive break-words [overflow-wrap:anywhere]">{error}</span> : <span />}
              <span>{feedback.length}/2000</span>
            </div>
          </div>

          <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1 min-w-0">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Flagged Items to Correct ({flaggedItems.length})
            </p>
            {flaggedItems.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-amber-200/80 bg-amber-50/50 p-2.5 text-xs dark:border-amber-900/60 dark:bg-amber-950/20 min-w-0 break-words [overflow-wrap:anywhere]"
              >
                <p className="font-semibold text-foreground break-words [overflow-wrap:anywhere]">{item.label}</p>
                <p className="mt-1 text-muted-foreground whitespace-pre-wrap break-words [overflow-wrap:anywhere] [word-break:break-word]">
                  <ExpandableText text={item.reason || "Please review and update this item."} limit={140} />
                </p>
              </div>
            ))}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-600 dark:hover:bg-amber-700"
              disabled={isPending || flaggedItems.length === 0 || !feedback.trim()}
            >
              {isPending ? <Spinner className="size-4 mr-2" /> : <FileEdit className="size-4 mr-2" />}
              Send Revision Request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Reject Dialog                                                      */
/* ------------------------------------------------------------------ */

export function RejectRequestDialog({
  request,
  open,
  onOpenChange,
  onConfirm,
  isPending = false,
}: {
  request: RequestRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => Promise<void> | void;
  isPending?: boolean;
}) {
  useCloseOnConflict(open, () => onOpenChange(false));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (open) {
      setReason("");
      setError(null);
      isSubmittingRef.current = false;
    }
  }, [open]);

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (isSubmittingRef.current || isPending) return;

    const trimmed = reason.trim();
    if (!trimmed) {
      setError("Please provide a reason for rejecting the request.");
      return;
    }

    isSubmittingRef.current = true;
    try {
      await onConfirm(trimmed);
      onOpenChange(false);
    } finally {
      isSubmittingRef.current = false;
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md w-full max-w-[calc(100vw-2rem)]">
        <form onSubmit={handleSubmit} className="space-y-4 min-w-0">
          <DialogHeader className="min-w-0">
            <div className="mb-1 flex size-10 items-center justify-center rounded-xl border border-rose-300/80 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300">
              <XCircle className="size-5" aria-hidden="true" />
            </div>
            <DialogTitle className="font-heading text-xl font-medium break-words [overflow-wrap:anywhere]">Reject Request</DialogTitle>
            <DialogDescription className="break-words [overflow-wrap:anywhere]">
              Rejecting request <span className="font-mono font-semibold text-foreground break-all">{request.code}</span>{" "}
              will permanently close the review and notify the resident.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 min-w-0">
            <label htmlFor="rejection-reason-input" className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Rejection Reason <span className="text-destructive">*</span>
            </label>
            <Textarea
              id="rejection-reason-input"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError(null);
              }}
              placeholder="State clearly why the request is rejected according to community rules..."
              rows={4}
              maxLength={2000}
              disabled={isPending}
              className="resize-none break-words [overflow-wrap:anywhere]"
              autoFocus
            />
            <div className="flex justify-between text-[11px] text-muted-foreground">
              {error ? <span className="font-medium text-destructive break-words [overflow-wrap:anywhere]">{error}</span> : <span />}
              <span>{reason.length}/2000</span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={isPending || !reason.trim()}
            >
              {isPending ? <Spinner className="size-4 mr-2" /> : <XCircle className="size-4 mr-2" />}
              Confirm Rejection
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
