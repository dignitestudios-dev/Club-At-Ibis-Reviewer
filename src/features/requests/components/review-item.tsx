"use client";

import { useState } from "react";
import { Check, Edit2, Eye, FileImage, FileText, Flag, RefreshCw, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import type { PreviewableFile } from "@/components/shared/file-preview-dialog";
import { formatDate, formatFileSize } from "@/utils/format";
import { cn } from "@/utils/cn";

export function ReviewState({
  review,
  canReview = false,
}: {
  review?: ItemReview;
  canReview?: boolean;
}) {
  if (review?.state === "flagged") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/80 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
        <Flag className="size-3" aria-hidden="true" />
        Flagged for revision
      </span>
    );
  }
  if (review?.state === "accepted") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/80 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
        <Check className="size-3" aria-hidden="true" />
        Accepted
      </span>
    );
  }
  if (canReview) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/80 bg-emerald-50/50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400">
        <Check className="size-3" aria-hidden="true" />
        Accepted (default)
      </span>
    );
  }
  return null;
}

/** One uploaded file's own flag/accept row — each file gets its own review item on the backend, so its state and edit UI must be independent of any sibling files under the same field. */
function FileReviewRow({
  file,
  review,
  canReview,
  onPreview,
  onSaveFlag,
  onClearFlag,
  isAssessing = false,
}: {
  file: AttachedFile;
  review?: ItemReview;
  canReview: boolean;
  onPreview: (file: PreviewableFile) => void;
  onSaveFlag?: (fileId: string, reason: string) => Promise<void> | void;
  onClearFlag?: (fileId: string) => Promise<void> | void;
  isAssessing?: boolean;
}) {
  const isFlagged = review?.state === "flagged";
  const [isEditing, setIsEditing] = useState(false);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenEdit = () => {
    setReason(review?.reason || "");
    setIsEditing(true);
  };
  const handleCancelEdit = () => {
    setIsEditing(false);
    setReason("");
  };
  const handleSave = async () => {
    if (isSubmitting || !onSaveFlag) return;
    setIsSubmitting(true);
    try {
      const finalReason = reason.trim() || "Please replace this document.";
      await onSaveFlag(file.id, finalReason);
      setIsEditing(false);
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleClear = async () => {
    if (isSubmitting || !onClearFlag) return;
    setIsSubmitting(true);
    try {
      await onClearFlag(file.id);
      setIsEditing(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={cn(
        "rounded-xl border px-3.5 py-2.5 transition-colors",
        isFlagged
          ? "border-amber-300/90 bg-amber-50/60 dark:border-amber-800/80 dark:bg-amber-950/20"
          : review?.state === "accepted" || canReview
            ? "border-emerald-200/80 bg-card"
            : "border-border/80 bg-muted/30"
      )}
    >
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card">
          {/\.(jpe?g|png)$/i.test(file.name) ? (
            <FileImage className="size-4 text-sky-600" />
          ) : (
            <FileText className="size-4 text-rose-600" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {formatFileSize(file.size)} · uploaded {formatDate(file.uploadedAt)}
          </p>
        </div>
        <ReviewState review={review} canReview={canReview} />
        <Button variant="outline" size="sm" onClick={() => onPreview(file)}>
          <Eye />
          Preview
        </Button>
      </div>

      {isFlagged && review?.reason && !isEditing && (
        <div className="mt-2.5 rounded-lg border border-amber-300/80 bg-amber-50/90 px-3.5 py-2.5 text-xs text-amber-950 dark:border-amber-800/80 dark:bg-amber-950/40 dark:text-amber-200 min-w-0 break-words [overflow-wrap:anywhere]">
          <p className="mb-1 flex items-center gap-1.5 font-semibold">
            <Flag className="size-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
            Reviewer Correction Note:
          </p>
          <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] [word-break:break-word]">{review.reason}</p>
        </div>
      )}

      {isEditing && (
        <div className="mt-2.5 space-y-3 rounded-lg border border-amber-300/80 bg-amber-50/50 p-3.5 dark:border-amber-800/80 dark:bg-amber-950/30">
          <div className="space-y-1.5">
            <label
              htmlFor={`flag-reason-${file.id}`}
              className="flex items-center justify-between text-[11px] font-semibold tracking-wider text-amber-950 uppercase dark:text-amber-300"
            >
              <span>Correction instructions (Optional)</span>
              <span className="text-[10px] font-normal text-muted-foreground">{reason.length}/1000</span>
            </label>
            <Textarea
              id={`flag-reason-${file.id}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                  e.preventDefault();
                  handleSave();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  handleCancelEdit();
                }
              }}
              placeholder="Optional: explain what's wrong with this document..."
              rows={3}
              maxLength={1000}
              disabled={isSubmitting || isAssessing}
              className="resize-none bg-background text-xs"
              autoFocus
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <p className="text-[11px] text-muted-foreground">
              Press <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">Ctrl+Enter</kbd> to save
            </p>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={handleCancelEdit} disabled={isSubmitting || isAssessing}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-600 dark:hover:bg-amber-700"
                onClick={handleSave}
                disabled={isSubmitting || isAssessing}
              >
                {isSubmitting || isAssessing ? <Spinner className="size-3 mr-1" /> : <Flag className="size-3 mr-1" />}
                {isFlagged ? "Update Flag" : "Flag Document"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {canReview && !isEditing && (
        <div className="mt-2.5 flex flex-wrap items-center justify-end gap-2 border-t border-border/50 pt-2.5">
          {isFlagged ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs h-7 text-muted-foreground hover:text-foreground"
                onClick={handleClear}
                disabled={isSubmitting || isAssessing}
              >
                {isSubmitting ? <Spinner className="size-3 mr-1" /> : <Undo2 className="size-3 mr-1" />}
                Clear Flag (Accept)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs h-7 border-amber-300 text-amber-900 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/40"
                onClick={handleOpenEdit}
                disabled={isSubmitting || isAssessing}
              >
                <Edit2 className="size-3 mr-1" />
                Edit Note
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-7 text-amber-700 hover:text-amber-800 hover:bg-amber-50 hover:border-amber-300 dark:text-amber-400 dark:hover:bg-amber-950/40 dark:hover:border-amber-800"
              onClick={handleOpenEdit}
              disabled={isSubmitting || isAssessing}
            >
              <Flag className="size-3 mr-1" />
              Flag Document
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function ReviewItem({
  request,
  field,
  canReview = false,
  changed = false,
  previous,
  onPreview,
  onSaveFlag,
  onClearFlag,
  onSaveFileFlag,
  onClearFileFlag,
  isAssessing = false,
}: {
  request: RequestRecord;
  field: CategoryField;
  canReview?: boolean;
  changed?: boolean;
  previous?: string;
  onPreview: (file: PreviewableFile) => void;
  onSaveFlag?: (fieldId: string, reason: string) => Promise<void> | void;
  onClearFlag?: (field: CategoryField) => Promise<void> | void;
  onSaveFileFlag?: (fileId: string, reason: string) => Promise<void> | void;
  onClearFileFlag?: (fileId: string) => Promise<void> | void;
  isAssessing?: boolean;
}) {
  const state = request.itemReviews[field.id];
  const isFile = field.type === "file";
  const files = request.uploads[field.id] ?? [];
  const value = request.fieldValues[field.id];
  const isFlagged = state?.state === "flagged";
  const activeReviewItem = request.review?.items.find((it) => it.fieldId === field.id);
  const carriedForward = activeReviewItem?.carriedForward;

  const [isEditing, setIsEditing] = useState(false);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenEdit = () => {
    setReason(state?.reason || "");
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setReason("");
  };

  const handleSave = async () => {
    if (isSubmitting || !onSaveFlag) return;
    setIsSubmitting(true);
    try {
      const finalReason = reason.trim() || "Please review and update this field.";
      await onSaveFlag(field.id, finalReason);
      setIsEditing(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClear = async () => {
    if (isSubmitting || !onClearFlag) return;
    setIsSubmitting(true);
    try {
      await onClearFlag(field);
      setIsEditing(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={cn(
        "space-y-3 rounded-xl border p-4 transition-colors",
        isFlagged
          ? "border-amber-300/90 bg-amber-50/60 dark:border-amber-800/80 dark:bg-amber-950/20"
          : state?.state === "accepted" || canReview
            ? "border-emerald-200/80 bg-card hover:border-emerald-300/70 dark:border-emerald-900/60"
            : "border-border/80 bg-card"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="flex flex-wrap items-center gap-2 text-[11px] font-semibold tracking-wider uppercase">
            <span className="text-foreground">{field.label}</span>
            <span className="font-normal tracking-normal normal-case text-muted-foreground">
              {field.required ? "Required" : "Optional"}
            </span>
            {changed && (
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-px text-[10px] font-bold tracking-wide text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
                <RefreshCw className="size-2.5" aria-hidden="true" />
                Updated by resident
              </span>
            )}
            {carriedForward && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-px text-[10px] font-medium text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                Carried forward
              </span>
            )}
          </p>
        </div>
        <ReviewState review={state} canReview={canReview && !isFile} />
      </div>

      {isFile ? (
        <div className="space-y-2">
          {files.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No file uploaded</p>
          ) : (
            files.map((file) => (
              <FileReviewRow
                key={file.id}
                file={file}
                review={request.fileItemReviews?.[file.id]}
                canReview={canReview}
                onPreview={onPreview}
                onSaveFlag={onSaveFileFlag}
                onClearFlag={onClearFileFlag}
                isAssessing={isAssessing}
              />
            ))
          )}
        </div>
      ) : (
        <p className="text-sm leading-relaxed whitespace-pre-line text-foreground break-words [overflow-wrap:anywhere]">
          {value || <span className="text-muted-foreground italic">Not provided</span>}
        </p>
      )}

      {changed && previous && (
        <div className="rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-xs text-muted-foreground break-words [overflow-wrap:anywhere]">
          <span className="font-semibold text-foreground">Previously:</span>{" "}
          <span className="line-through decoration-slate-400/60 [overflow-wrap:anywhere]">
            {previous}
          </span>
        </div>
      )}

      {isFlagged && state.reason && !isEditing && (
        <div className="rounded-lg border border-amber-300/80 bg-amber-50/90 px-3.5 py-2.5 text-xs text-amber-950 dark:border-amber-800/80 dark:bg-amber-950/40 dark:text-amber-200 min-w-0 break-words [overflow-wrap:anywhere]">
          <p className="font-semibold flex items-center gap-1.5 mb-1">
            <Flag className="size-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
            Reviewer Correction Note:
          </p>
          <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] [word-break:break-word]">{state.reason}</p>
        </div>
      )}

      {/* Inline Flag Editor Box */}
      {isEditing && (
        <div className="mt-3 space-y-3 rounded-lg border border-amber-300/80 bg-amber-50/50 p-3.5 dark:border-amber-800/80 dark:bg-amber-950/30">
          <div className="space-y-1.5">
            <label
              htmlFor={`flag-reason-${field.id}`}
              className="flex items-center justify-between text-[11px] font-semibold tracking-wider text-amber-950 uppercase dark:text-amber-300"
            >
              <span>Correction instructions (Optional)</span>
              <span className="text-[10px] font-normal text-muted-foreground">{reason.length}/1000</span>
            </label>
            <Textarea
              id={`flag-reason-${field.id}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                  e.preventDefault();
                  handleSave();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  handleCancelEdit();
                }
              }}
              placeholder="Optional: explain what the resident needs to correct for this field..."
              rows={3}
              maxLength={1000}
              disabled={isSubmitting || isAssessing}
              className="resize-none bg-background text-xs"
              autoFocus
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <p className="text-[11px] text-muted-foreground">
              Press <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">Ctrl+Enter</kbd> to save
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={handleCancelEdit}
                disabled={isSubmitting || isAssessing}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-600 dark:hover:bg-amber-700"
                onClick={handleSave}
                disabled={isSubmitting || isAssessing}
              >
                {isSubmitting || isAssessing ? (
                  <Spinner className="size-3 mr-1" />
                ) : (
                  <Flag className="size-3 mr-1" />
                )}
                {isFlagged ? "Update Flag" : "Flag Field"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reviewer Action Buttons when in Active Review and not actively editing */}
      {canReview && !isFile && !isEditing && (
        <div className="flex flex-wrap items-center justify-end gap-2 pt-1 border-t border-border/50">
          {isFlagged ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs h-7 text-muted-foreground hover:text-foreground"
                onClick={handleClear}
                disabled={isSubmitting || isAssessing}
              >
                {isSubmitting ? <Spinner className="size-3 mr-1" /> : <Undo2 className="size-3 mr-1" />}
                Clear Flag (Accept)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs h-7 border-amber-300 text-amber-900 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/40"
                onClick={handleOpenEdit}
                disabled={isSubmitting || isAssessing}
              >
                <Edit2 className="size-3 mr-1" />
                Edit Note
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-7 text-amber-700 hover:text-amber-800 hover:bg-amber-50 hover:border-amber-300 dark:text-amber-400 dark:hover:bg-amber-950/40 dark:hover:border-amber-800"
              onClick={handleOpenEdit}
              disabled={isSubmitting || isAssessing}
            >
              <Flag className="size-3 mr-1" />
              Flag for revision
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
