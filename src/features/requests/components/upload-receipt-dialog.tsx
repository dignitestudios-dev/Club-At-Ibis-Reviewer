"use client";

import { announceRequestConflict, useCloseOnConflict } from "@/hooks/use-close-on-conflict";
import { useRefreshRequest } from "@/hooks/use-reviewer-data";
import { useState, useRef } from "react";
import { UploadCloud, FileText, CheckCircle2, AlertCircle, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { getUnfinishedUpload, uploadProcessingFile } from "../api/processing-upload";
import { formatFileSize } from "@/utils/format";

const MAX_FILE_SIZE = 52428800; // 50 MiB
const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
const ALLOWED_EXTS = [".pdf", ".png", ".jpg", ".jpeg"];

function isFileTypeAllowed(file: File): boolean {
  if (ALLOWED_TYPES.includes(file.type.toLowerCase())) return true;
  const name = file.name.toLowerCase();
  return ALLOWED_EXTS.some((ext) => name.endsWith(ext));
}

interface UploadReceiptDialogProps {
  request: RequestRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Replacing the receipt that is already attached (the previous file stays in the backend's history). */
  isReplacing?: boolean;
}

export function UploadReceiptDialog({ request, open, onOpenChange, isReplacing = false }: UploadReceiptDialogProps) {
  useCloseOnConflict(open, () => { resetState(); onOpenChange(false); });
  const toast = useToast();
  const refreshRequest = useRefreshRequest();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const unfinished = open ? getUnfinishedUpload(request.id, "deposit_receipt") : null;
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function resetState() {
    setSelectedFile(null);
    setDragActive(false);
    setIsUploading(false);
    setUploadProgress(0);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleDialogClose(nextOpen: boolean) {
    if (isUploading) return;
    if (!nextOpen) {
      resetState();
    }
    onOpenChange(nextOpen);
  }

  function validateAndSetFile(file: File) {
    setErrorMessage(null);
    if (!isFileTypeAllowed(file)) {
      setErrorMessage("Invalid file type. Please upload a PDF or image (PNG, JPG, JPEG).");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setErrorMessage(`File exceeds maximum size of 50 MB (selected: ${formatFileSize(file.size)}).`);
      return;
    }
    setSelectedFile(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!isUploading) {
      setDragActive(true);
    }
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (isUploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  }

  async function handleUpload() {
    if (!selectedFile || isUploading) return;
    setIsUploading(true);
    setErrorMessage(null);
    setUploadProgress(0);

    try {
      await uploadProcessingFile({
        request,
        purpose: "deposit_receipt",
        file: selectedFile,
        onProgress: (progress) => setUploadProgress(progress),
      });

      // Stay in the loading state until the refreshed request is back, so the page behind the dialog
      // already shows the new state the moment the dialog closes.
      setUploadProgress(100);
      await refreshRequest(request.id);
      toast.success(isReplacing ? "Deposit receipt replaced" : "Deposit receipt recorded", "Payment receipt was uploaded and verified successfully.");
      resetState();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Receipt upload error:", err);
      if (err?.status === 409) {
        void refreshRequest(request.id, "none");
        toast.warning("Request updated", "This request was changed elsewhere (for example in another tab), so it has been refreshed. Review the latest details and try again.");
        announceRequestConflict();
      }
      setErrorMessage(err?.message || "The upload failed. Please try again.");
      setIsUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="sm:max-w-md w-full max-w-[calc(100vw-2rem)]">
        <DialogHeader className="min-w-0">
          <div className="mb-1 flex size-10 items-center justify-center rounded-xl border border-amber-300/80 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
            <UploadCloud className="size-5" aria-hidden="true" />
          </div>
          <DialogTitle className="font-heading text-xl font-medium break-words [overflow-wrap:anywhere]">
            {isReplacing ? "Edit Deposit Receipt" : "Upload Deposit Receipt"}
          </DialogTitle>
          <DialogDescription className="break-words [overflow-wrap:anywhere]">
            {isReplacing ? "Upload a corrected receipt for request" : "Upload proof of deposit collection for request"}{" "}
            <span className="font-mono font-semibold text-foreground break-all">{request.code}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {unfinished && !selectedFile && !isUploading && (
            <p className="rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-800/70 dark:bg-amber-950/30 dark:text-amber-200">
              An earlier upload didn’t finish. Choose <span className="font-semibold">{unfinished.name}</span> ({formatFileSize(unfinished.size)}) again to resume it.
            </p>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
            className="hidden"
            onChange={handleFileChange}
            disabled={isUploading}
          />

          {!selectedFile ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !isUploading && fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
                dragActive
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/60 hover:bg-muted/30"
              }`}
            >
              <UploadCloud className="size-8 text-muted-foreground mb-2" />
              <p className="text-sm font-medium text-foreground">Click to browse or drag & drop</p>
              <p className="text-xs text-muted-foreground mt-1">PDF, PNG, JPG or JPEG (up to 50 MB)</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border/80 bg-muted/30 p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="size-6 text-amber-600 dark:text-amber-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                </div>
              </div>
              {!isUploading && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-foreground shrink-0"
                  onClick={resetState}
                  aria-label="Remove selected file"
                >
                  <X className="size-4" />
                </Button>
              )}
            </div>
          )}

          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Uploading to secure storage...</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          )}

          {errorMessage && (
            <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive break-words [overflow-wrap:anywhere]">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span className="break-words [overflow-wrap:anywhere]">{errorMessage}</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleDialogClose(false)}
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-600 dark:hover:bg-amber-700"
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
          >
            {isUploading ? <Spinner className="size-4 mr-2" /> : <CheckCircle2 className="size-4 mr-2" />}
            {isUploading ? "Uploading Receipt..." : isReplacing ? "Replace Receipt" : "Upload Receipt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
