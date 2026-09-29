"use client";

import { useEffect, useState, useRef } from "react";
import { AlertTriangle, CheckCircle2, FileEdit, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";

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
  onConfirm: () => Promise<void> | void;
  isPending?: boolean;
}) {
  const isSubmittingRef = useRef(false);

  async function handleConfirm() {
    if (isSubmittingRef.current || isPending) return;
    isSubmittingRef.current = true;
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      isSubmittingRef.current = false;
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md w-full max-w-[calc(100vw-2rem)]">
        <DialogHeader>
          <div className="mb-1 flex size-10 items-center justify-center rounded-xl border border-emerald-300/80 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
            <CheckCircle2 className="size-5" aria-hidden="true" />
          </div>
          <DialogTitle className="font-heading text-xl font-medium">Approve Request</DialogTitle>
          <DialogDescription className="break-words">
            Are you sure you want to approve request{" "}
            <span className="font-mono font-semibold text-foreground">{request.code}</span>?
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-3.5 text-xs text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300">
          <p className="font-medium">All form fields and submitted materials will be marked as accepted.</p>
          <p className="mt-1 text-muted-foreground">The resident will be notified that their request has been approved.</p>
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
            type="button"
            className="bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-600 dark:hover:bg-emerald-700"
            onClick={handleConfirm}
            disabled={isPending}
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
  onConfirm: () => Promise<void> | void;
  isPending?: boolean;
}) {
  const isSubmittingRef = useRef(false);

  const flaggedItems = (request.formSnapshot || [])
    .filter((f: CategoryField) => request.itemReviews[f.id]?.state === "flagged")
    .map((f: CategoryField) => ({
      fieldId: f.id,
      label: f.label,
      reason: request.itemReviews[f.id]?.reason || "",
    }));

  async function handleConfirm() {
    if (isSubmittingRef.current || isPending) return;
    isSubmittingRef.current = true;
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      isSubmittingRef.current = false;
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg w-full max-w-[calc(100vw-2rem)]">
        <DialogHeader>
          <div className="mb-1 flex size-10 items-center justify-center rounded-xl border border-amber-300/80 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
            <FileEdit className="size-5" aria-hidden="true" />
          </div>
          <DialogTitle className="font-heading text-xl font-medium">Request Corrections</DialogTitle>
          <DialogDescription className="break-words">
            The resident will be asked to update{" "}
            <span className="font-semibold text-foreground">
              {flaggedItems.length} flagged field{flaggedItems.length === 1 ? "" : "s"}
            </span>{" "}
            for <span className="font-mono font-semibold text-foreground">{request.code}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Correction Items Summary
          </p>
          {flaggedItems.map((item: { fieldId: string; label: string; reason: string }) => (
            <div
              key={item.fieldId}
              className="rounded-lg border border-amber-200/80 bg-amber-50/50 p-3 text-xs dark:border-amber-900/60 dark:bg-amber-950/20"
            >
              <p className="font-semibold text-foreground">{item.label}</p>
              <p className="mt-1 text-muted-foreground whitespace-pre-wrap">
                {item.reason || "Please review and update this field."}
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
            type="button"
            className="bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-600 dark:hover:bg-amber-700"
            onClick={handleConfirm}
            disabled={isPending || flaggedItems.length === 0}
          >
            {isPending ? <Spinner className="size-4 mr-2" /> : <FileEdit className="size-4 mr-2" />}
            Send Revision Request
          </Button>
        </DialogFooter>
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
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <div className="mb-1 flex size-10 items-center justify-center rounded-xl border border-rose-300/80 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300">
              <XCircle className="size-5" aria-hidden="true" />
            </div>
            <DialogTitle className="font-heading text-xl font-medium">Reject Request</DialogTitle>
            <DialogDescription className="break-words">
              Rejecting request <span className="font-mono font-semibold text-foreground">{request.code}</span>{" "}
              will permanently close the review and notify the resident.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
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
              className="resize-none"
              autoFocus
            />
            <div className="flex justify-between text-[11px] text-muted-foreground">
              {error ? <span className="font-medium text-destructive">{error}</span> : <span />}
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
