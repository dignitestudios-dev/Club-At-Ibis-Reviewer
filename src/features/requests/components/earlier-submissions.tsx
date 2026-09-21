"use client";

import { useState } from "react";
import { ChevronDown, Eye, FileText, Flag, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PreviewableFile } from "@/components/shared/file-preview-dialog";
import { ReviewState } from "@/features/requests/components/review-item";
import { earlierSubmissions } from "@/lib/domain";
import { formatDateTime, formatFileSize } from "@/utils/format";
import { cn } from "@/utils/cn";

function SubmissionRow({ request, submission, onPreview, defaultOpen }: { request: RequestRecord; submission: SubmissionSnapshot; onPreview: (f: PreviewableFile) => void; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const fields = [...request.formSnapshot].sort((a, b) => a.order - b.order);
  const flagged = Object.values(submission.itemReviews).filter((r) => r.state === "flagged").length;

  return (
    <div className="rounded-xl border border-border/80">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted font-heading text-sm font-semibold">#{submission.number}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">Submission {submission.number}</span>
          <span className="block text-xs text-muted-foreground">
            Submitted {formatDateTime(submission.submittedAt)} · reviewed {formatDateTime(submission.reviewedAt)}
          </span>
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/80 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          <Flag className="size-3" aria-hidden="true" />
          {flagged} flagged
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>

      {open && (
        <div className="space-y-3 border-t border-border/70 px-4 py-4">
          {submission.feedback && (
            <div className="rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-2 text-xs whitespace-pre-line text-amber-950 dark:border-amber-800/70 dark:bg-amber-950/30 dark:text-amber-200">
              <span className="font-semibold">Feedback sent to the resident:</span> {submission.feedback}
            </div>
          )}
          <ul className="space-y-2">
            {fields.map((field) => {
              const review = submission.itemReviews[field.id];
              const files = submission.uploads[field.id] ?? [];
              const value = submission.fieldValues[field.id];
              if (field.type === "file" ? files.length === 0 : !value) return null;
              return (
                <li key={field.id} className={cn("space-y-1.5 rounded-lg border p-3", review?.state === "flagged" ? "border-amber-300/70 bg-amber-50/40 dark:border-amber-800/60 dark:bg-amber-950/10" : "border-border/70")}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{field.label}</p>
                    <ReviewState review={review} />
                  </div>
                  {field.type === "file" ? (
                    files.map((f) => (
                      <div key={f.id} className="flex items-center gap-2.5 text-sm">
                        <FileText className="size-4 shrink-0 text-rose-600" aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate">{f.name}</span>
                        <span className="text-[11px] text-muted-foreground">{formatFileSize(f.size)}</span>
                        <Button variant="outline" size="xs" onClick={() => onPreview(f)}>
                          <Eye />
                          Preview
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm whitespace-pre-line text-foreground">{value}</p>
                  )}
                  {review?.state === "flagged" && review.reason && <p className="text-xs text-amber-900 dark:text-amber-300">Note: {review.reason}</p>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Earlier submissions stay on the request after the resident resubmits, exactly as they were reviewed. */
export function EarlierSubmissions({ request, onPreview }: { request: RequestRecord; onPreview: (f: PreviewableFile) => void }) {
  const list = earlierSubmissions(request);
  if (list.length === 0) return null;
  return (
    <Card className="rounded-xl border border-border/70 bg-transparent shadow-none ring-0">
      <CardHeader className="border-b border-border/70 pb-3">
        <CardTitle className="flex items-center gap-2 font-heading text-lg font-medium">
          <History className="size-4 text-muted-foreground" aria-hidden="true" />
          Earlier submissions
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          What the resident originally submitted and how you reviewed it. These are kept after they resubmit and never change.
        </p>
      </CardHeader>
      <CardContent className="space-y-3 pt-4">
        {list.map((s, i) => (
          <SubmissionRow key={s.id} request={request} submission={s} onPreview={onPreview} defaultOpen={i === 0} />
        ))}
      </CardContent>
    </Card>
  );
}
