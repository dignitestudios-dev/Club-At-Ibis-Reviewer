"use client";

import { useState } from "react";
import { Check, Eye, FileImage, FileText, Flag, Pencil, RefreshCw, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { PreviewableFile } from "@/components/shared/file-preview-dialog";
import { useReviewItem } from "@/hooks/use-reviewer-data";
import { useToast } from "@/hooks/use-toast";
import { formatDate, formatFileSize } from "@/utils/format";
import { cn } from "@/utils/cn";

export function ReviewState({ review }: { review?: ItemReview }) {
  if (review?.state === "accepted") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/80 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
        <Check className="size-3" aria-hidden="true" />
        Accepted
      </span>
    );
  }
  if (review?.state === "flagged") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/80 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
        <Flag className="size-3" aria-hidden="true" />
        Flagged
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      To review
    </span>
  );
}

/**
 * One field or file on the review screen. While the reviewer can review, each
 * item can be accepted or flagged (with a mandatory reason), and an already
 * accepted item can be flagged again until the request is approved.
 */
export function ReviewItem({
  request,
  field,
  canReview,
  changed,
  previous,
  onPreview,
}: {
  request: RequestRecord;
  field: CategoryField;
  canReview: boolean;
  /** The resident changed this item while resubmitting. */
  changed: boolean;
  previous?: string;
  onPreview: (file: PreviewableFile) => void;
}) {
  const toast = useToast();
  const review = useReviewItem();
  const state = request.itemReviews[field.id];
  const [flagging, setFlagging] = useState(false);
  const [reason, setReason] = useState("");
  const isFile = field.type === "file";
  const files = request.uploads[field.id] ?? [];
  const value = request.fieldValues[field.id];

  function accept() {
    review.mutate(
      { requestId: request.id, fieldId: field.id, state: "accepted" },
      { onError: (e: Error) => toast.error("Could not save", e.message) }
    );
  }

  function openFlag() {
    setReason(state?.state === "flagged" ? state.reason ?? "" : "");
    setFlagging(true);
  }

  function submitFlag() {
    review.mutate(
      { requestId: request.id, fieldId: field.id, state: "flagged", reason },
      {
        onSuccess: () => setFlagging(false),
        onError: (e: Error) => toast.error("Could not save", e.message),
      }
    );
  }

  return (
    <div
      className={cn(
        "space-y-3 rounded-xl border p-4 transition-colors",
        state?.state === "flagged" ? "border-amber-300/80 bg-amber-50/50 dark:border-amber-800/70 dark:bg-amber-950/15" : state?.state === "accepted" ? "border-emerald-200/80 bg-emerald-50/30 dark:border-emerald-900/60 dark:bg-emerald-950/10" : "border-border/80 bg-card"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="flex flex-wrap items-center gap-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            {field.label}
            <span className="font-normal tracking-normal normal-case">{field.required ? "Required" : "Optional"}</span>
            {changed && (
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-px text-[10px] font-bold tracking-wide text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
                <RefreshCw className="size-2.5" aria-hidden="true" />
                Updated by resident
              </span>
            )}
          </p>
        </div>
        <ReviewState review={state} />
      </div>

      {isFile ? (
        <div className="space-y-2">
          {files.map((file) => (
            <div key={file.id} className="flex items-center gap-3 rounded-xl border border-border/80 bg-muted/30 px-3.5 py-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card">
                {/\.(jpe?g|png)$/i.test(file.name) ? <FileImage className="size-4 text-sky-600" /> : <FileText className="size-4 text-rose-600" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {formatFileSize(file.size)} · uploaded {formatDate(file.uploadedAt)}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => onPreview(file)}>
                <Eye />
                Preview
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm leading-relaxed whitespace-pre-line text-foreground">{value}</p>
      )}

      {changed && previous && (
        <p className="rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Previously:</span> <span className="line-through decoration-slate-400/60">{previous}</span>
        </p>
      )}

      {state?.state === "flagged" && state.reason && !flagging && (
        <p className="rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-800/70 dark:bg-amber-950/30 dark:text-amber-200">
          <span className="font-semibold">Your note:</span> {state.reason}
        </p>
      )}

      {flagging && (
        <div className="space-y-2 rounded-lg border border-amber-300/70 bg-card p-3">
          <label htmlFor={`flag-${field.id}`} className="block text-xs font-semibold text-foreground">
            Note for the resident <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <Textarea
            id={`flag-${field.id}`}
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Optional — say what is wrong. Your overall feedback is written when you request a revision."
            className="resize-none"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setFlagging(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={submitFlag} disabled={review.isPending}>
              {review.isPending ? <Spinner className="size-4" /> : <Flag />}
              Flag item
            </Button>
          </div>
        </div>
      )}

      {canReview && !flagging && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
          {state?.state !== "accepted" && (
            <Button size="sm" variant={state ? "outline" : "default"} onClick={accept} disabled={review.isPending}>
              {state?.state === "flagged" ? <Undo2 /> : <Check />}
              {state?.state === "flagged" ? "Mark accepted instead" : "Accept"}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={openFlag} disabled={review.isPending}>
            {state?.state === "flagged" ? <Pencil /> : <Flag />}
            {state?.state === "flagged" ? "Edit note" : state?.state === "accepted" ? "Flag again" : "Flag for correction"}
          </Button>
        </div>
      )}
    </div>
  );
}
