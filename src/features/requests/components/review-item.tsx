"use client";

import { Check, Eye, FileImage, FileText, Flag, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PreviewableFile } from "@/components/shared/file-preview-dialog";
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
  return null;
}

export function ReviewItem({
  request,
  field,
  changed,
  previous,
  onPreview,
}: {
  request: RequestRecord;
  field: CategoryField;
  canReview?: boolean;
  changed?: boolean;
  previous?: string;
  onPreview: (file: PreviewableFile) => void;
}) {
  const state = request.itemReviews[field.id];
  const isFile = field.type === "file";
  const files = request.uploads[field.id] ?? [];
  const value = request.fieldValues[field.id];

  return (
    <div
      className={cn(
        "space-y-3 rounded-xl border p-4 transition-colors",
        state?.state === "flagged"
          ? "border-amber-300/80 bg-amber-50/50 dark:border-amber-800/70 dark:bg-amber-950/15"
          : state?.state === "accepted"
            ? "border-emerald-200/80 bg-emerald-50/30 dark:border-emerald-900/60 dark:bg-emerald-950/10"
            : "border-border/80 bg-card"
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
        <p className="text-sm leading-relaxed whitespace-pre-line text-foreground break-words">{value || "—"}</p>
      )}

      {changed && previous && (
        <p className="rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-xs text-muted-foreground break-words">
          <span className="font-semibold text-foreground">Previously:</span> <span className="line-through decoration-slate-400/60">{previous}</span>
        </p>
      )}

      {state?.state === "flagged" && state.reason && (
        <p className="rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-800/70 dark:bg-amber-950/30 dark:text-amber-200 break-words">
          <span className="font-semibold">Reviewer note:</span> {state.reason}
        </p>
      )}
    </div>
  );
}
