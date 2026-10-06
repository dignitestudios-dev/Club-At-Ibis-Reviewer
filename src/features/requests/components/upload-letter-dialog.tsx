"use client";

import { useRefreshRequest } from "@/hooks/use-reviewer-data";
import { useState, useRef } from "react";
import { UploadCloud, FileCheck2, CheckCircle2, AlertCircle, X } from "lucide-react";
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

interface UploadLetterDialogProps {
  request: RequestRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isReplacing?: boolean;
}

export function UploadLetterDialog({ request, open, onOpenChange, isReplacing = false }: UploadLetterDialogProps) {
  const toast = useToast();
  const refreshRequest = useRefreshRequest();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const unfinished = open ? getUnfinishedUpload(request.id, "final_approval_letter") : null;
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
        purpose: "final_approval_letter",
        file: selectedFile,
        onProgress: (progress) => setUploadProgress(progress),
      });

      // Stay in the loading state until the refreshed request is back, so the page behind the dialog
      // already shows the new state the moment the dialog closes.
      setUploadProgress(100);
      await refreshRequest(request.id);
      toast.success(
        isReplacing ? "Approval letter replaced" : "Approval letter uploaded",
        "Final approval letter is verified and ready for request completion."
      );
      resetState();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Letter upload error:", err);
      if (err?.status === 409) {
        void refreshRequest(request.id, "none");
      }
      setErrorMessage(err?.message || "The upload failed. Please try again.");
      setIsUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="sm:max-w-md w-full max-w-[calc(100vw-2rem)] overflow-hidden">
        <DialogHeader className="min-w-0">
          <div className="mb-1 flex size-10 items-center justify-center rounded-xl border border-teal-300/80 bg-teal-50 text-teal-800 dark:border-teal-800 dark:bg-teal-950/50 dark:text-teal-300">
            <FileCheck2 className="size-5" aria-hidden="true" />
          </div>
          <DialogTitle className="font-heading text-xl font-medium break-words [overflow-wrap:anywhere]">
            {isReplacing ? "Replace Final Approval Letter" : "Upload Final Approval Letter"}
          </DialogTitle>
          <DialogDescription className="break-words [overflow-wrap:anywhere]">
            {isReplacing
              ? "Upload a new final approval letter to replace the current document."
              : "Upload the official final approval letter for request "}
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
                <FileCheck2 className="size-6 text-teal-600 dark:text-teal-400 shrink-0" />
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

          <div className="rounded-xl border border-border/80 bg-muted/20 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Staff Visibility Notice</p>
            <p className="mt-0.5">
              This letter will remain hidden from the resident until the request is officially marked as <strong>Completed</strong>.
            </p>
          </div>
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
            className="bg-teal-600 hover:bg-teal-700 text-white dark:bg-teal-600 dark:hover:bg-teal-700"
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
          >
            {isUploading ? <Spinner className="size-4 mr-2" /> : <CheckCircle2 className="size-4 mr-2" />}
            {isUploading ? "Uploading Letter..." : isReplacing ? "Replace Letter" : "Upload Letter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
