"use client";

import { useState } from "react";
import { FileCheck2, UploadCloud, Eye, RefreshCw, Lock, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatFileSize, formatDateTime } from "@/utils/format";
import { UploadLetterDialog } from "./upload-letter-dialog";

interface ApprovalLetterCardProps {
  request: RequestRecord;
  isOwner: boolean;
  onPreviewFile?: (file: AttachedFile) => void;
}

export function ApprovalLetterCard({ request, isOwner, onPreviewFile }: ApprovalLetterCardProps) {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);

  const isApproved = request.status === "approved";
  const canManage = isOwner && isApproved;

  const letterFile = request.approvalLetter || request.completion?.finalApprovalLetter;

  return (
    <>
      <Card className="rounded-xl border border-border/70 bg-transparent shadow-none ring-0">
        <CardHeader className="border-b border-border/70 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="font-heading text-lg font-medium flex items-center gap-2">
                <FileCheck2 className="size-5 text-teal-600 dark:text-teal-400" />
                Final Approval Letter
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Official ARB approval letter delivered to the resident upon completion.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-teal-900 uppercase dark:bg-teal-950/40 dark:text-teal-300">
                <Lock className="size-2.5" /> Staff Managed
              </span>
              {canManage && letterFile && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsReplacing(true);
                    setUploadDialogOpen(true);
                  }}
                  className="h-8 gap-1 text-xs"
                >
                  <RefreshCw className="size-3.5" />
                  Replace Letter
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-5">
          {letterFile ? (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-teal-200/80 bg-teal-50/40 p-4 dark:border-teal-900/60 dark:bg-teal-950/20">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-teal-100 text-teal-700 dark:bg-teal-900/60 dark:text-teal-300 shrink-0">
                    <FileCheck2 className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {letterFile.name || "Final Approval Letter"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(letterFile.size)}
                      {letterFile.uploadedAt && ` · Uploaded ${formatDateTime(letterFile.uploadedAt)}`}
                    </p>
                  </div>
                </div>

                {onPreviewFile && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs shrink-0"
                    onClick={() => onPreviewFile(letterFile)}
                  >
                    <Eye className="size-3.5" />
                    Preview Letter
                  </Button>
                )}
              </div>

              {request.status !== "completed" && (
                <p className="text-xs text-muted-foreground px-1">
                  Note: The resident cannot view or download this document until the request is officially marked as Completed.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {isApproved ? (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-amber-300/70 bg-amber-50/50 p-4 dark:border-amber-900/70 dark:bg-amber-950/20">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-amber-950 dark:text-amber-200">
                        Final Approval Letter Required
                      </p>
                      <p className="text-xs text-amber-900/80 dark:text-amber-300/80 mt-0.5">
                        Upload the signed/final approval letter to prepare this request for completion.
                      </p>
                    </div>
                  </div>
                  {canManage && (
                    <Button
                      type="button"
                      size="sm"
                      className="bg-teal-600 hover:bg-teal-700 text-white dark:bg-teal-600 dark:hover:bg-teal-700 text-xs shrink-0"
                      onClick={() => {
                        setIsReplacing(false);
                        setUploadDialogOpen(true);
                      }}
                    >
                      <UploadCloud className="size-3.5 mr-1.5" />
                      Upload Letter
                    </Button>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No final approval letter has been uploaded yet. Final letters are uploaded after the request has been approved.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <UploadLetterDialog
        request={request}
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        isReplacing={isReplacing}
      />
    </>
  );
}
