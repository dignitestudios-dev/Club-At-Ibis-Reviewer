"use client";

import { useEffect, useState, useRef, useMemo } from "react";
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

  const flaggedFieldCount = Object.values(request.itemReviews || {}).filter((r) => r.state === "flagged").length;
  const flaggedFileCount = Object.values(request.fileItemReviews || {}).filter((r) => r.state === "flagged").length;
  const flaggedCount = (request.review?.items || []).length > 0
    ? (request.review?.items || []).filter((it) => it.decision === "flagged").length
    : flaggedFieldCount + flaggedFileCount;

  async function handleConfirm() {
    if (isSubmittingRef.current || isPending || flaggedCount > 0) return;
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

        {flaggedCount > 0 ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3.5 text-xs text-destructive">
            <p className="font-medium">
              This request has {flaggedCount} flagged item{flaggedCount === 1 ? "" : "s"} requiring correction. Clear all flags or click &ldquo;Request Revision&rdquo; instead.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-3.5 text-xs text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300">
            <p className="font-medium">All form fields and submitted materials will be marked as accepted.</p>
            <p className="mt-1 text-muted-foreground">The resident will be notified that their request has been approved.</p>
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
  onConfirm: () => Promise<void> | void;
  isPending?: boolean;
}) {
  const isSubmittingRef = useRef(false);

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
              {flaggedItems.length} flagged item{flaggedItems.length === 1 ? "" : "s"}
            </span>{" "}
            for <span className="font-mono font-semibold text-foreground">{request.code}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Correction Items Summary
          </p>
          {flaggedItems.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-amber-200/80 bg-amber-50/50 p-3 text-xs dark:border-amber-900/60 dark:bg-amber-950/20"
            >
              <p className="font-semibold text-foreground">{item.label}</p>
              <p className="mt-1 text-muted-foreground whitespace-pre-wrap">
                {item.reason || "Please review and update this item."}
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
