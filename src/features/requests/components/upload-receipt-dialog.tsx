"use client";

import { useState, useRef } from "react";
import { UploadCloud, FileText, CheckCircle2, AlertCircle, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { createProcessingFileUploadIntent, completeProcessingFileUpload } from "../api/review.service";
import { putFileToBlob } from "../api/blob-upload";
import { formatFileSize } from "@/utils/format";

const MAX_FILE_SIZE = 52428800; // 50 MiB
const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
const ALLOWED_EXTS = [".pdf", ".png", ".jpg", ".jpeg"];

function isFileTypeAllowed(file: File): boolean {
  if (ALLOWED_TYPES.includes(file.type.toLowerCase())) return true;
  const name = file.name.toLowerCase();
  return ALLOWED_EXTS.some((ext) => name.endsWith(ext));
}

function generateClientUploadId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "upl-" + Math.random().toString(36).substring(2, 11) + "-" + Date.now();
}

interface UploadReceiptDialogProps {
  request: RequestRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UploadReceiptDialog({ request, open, onOpenChange }: UploadReceiptDialogProps) {
  const toast = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
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
      // 1. Create upload intent
      const intent = await createProcessingFileUploadIntent({
        requestId: request.id,
        expectedAssignmentVersion: request.assignmentVersion ?? 0,
        expectedWorkflowVersion: request.workflowVersion ?? 1,
        expectedMediaRevision: request.mediaRevision ?? 0,
        purpose: "deposit_receipt",
        clientUploadId: generateClientUploadId(),
        originalName: selectedFile.name,
        size: selectedFile.size,
        declaredMimeType: selectedFile.type || "application/pdf",
      });

      // 2. Direct binary upload to Azure Blob Storage
      await putFileToBlob(
        intent.upload.url,
        selectedFile,
        intent.upload.headers || {},
        (progress) => setUploadProgress(progress)
      );

      // 3. Mark processing file complete
      await completeProcessingFileUpload({
        requestId: request.id,
        fileId: intent.file.id,
        expectedAssignmentVersion: request.assignmentVersion ?? 0,
        expectedWorkflowVersion: request.workflowVersion ?? 1,
        expectedMediaRevision: intent.mediaRevision ?? 0,
      });

      toast.success("Deposit receipt recorded", "Payment receipt was uploaded and verified successfully.");
      qc.invalidateQueries({ queryKey: ["requests", request.id] });
      qc.invalidateQueries({ queryKey: ["requests"] });
      handleDialogClose(false);
    } catch (err: any) {
      console.error("Receipt upload error:", err);
      if (err?.response?.status === 409) {
        setErrorMessage("The request was updated in another session. Please refresh and try again.");
        qc.invalidateQueries({ queryKey: ["requests", request.id] });
      } else {
        setErrorMessage(err?.response?.data?.message || err?.message || "Failed to upload deposit receipt.");
      }
      setIsUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="sm:max-w-md w-full max-w-[calc(100vw-2rem)] overflow-hidden">
        <DialogHeader className="min-w-0">
          <div className="mb-1 flex size-10 items-center justify-center rounded-xl border border-amber-300/80 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
            <UploadCloud className="size-5" aria-hidden="true" />
          </div>
          <DialogTitle className="font-heading text-xl font-medium break-words [overflow-wrap:anywhere]">
            Upload Deposit Receipt
          </DialogTitle>
          <DialogDescription className="break-words [overflow-wrap:anywhere]">
            Upload proof of deposit collection for request{" "}
            <span className="font-mono font-semibold text-foreground break-all">{request.code}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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
            {isUploading ? "Uploading Receipt..." : "Upload Receipt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
