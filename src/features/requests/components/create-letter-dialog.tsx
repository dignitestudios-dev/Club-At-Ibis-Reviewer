"use client";

import { useRefreshRequest } from "@/hooks/use-reviewer-data";
import { useEffect, useRef, useState } from "react";
import { Download, Eye, FilePenLine, FileText, RotateCcw, Send } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useMe } from "@/hooks/use-current-user";
import { cn } from "@/utils/cn";
import { uploadProcessingFile } from "../api/processing-upload";
import { buildLetterPdf } from "../letter/letter-pdf";
import { buildDefaultLetter, letterFileName, type LetterDraft } from "../letter/letter-template";

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs font-semibold text-foreground">
        {label}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * Compose the final approval letter on the Club at Ibis letterhead, see the real PDF update live,
 * then generate it and upload it through the same pipeline as a manually uploaded letter.
 */
export function CreateLetterDialog({
  request,
  open,
  onOpenChange,
  isReplacing = false,
}: {
  request: RequestRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isReplacing?: boolean;
}) {
  const toast = useToast();
  const refreshRequest = useRefreshRequest();
  const { me } = useMe();

  const [letter, setLetter] = useState<LetterDraft | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Fresh template every time the dialog opens
  useEffect(() => {
    if (!open) return;
    setLetter(buildDefaultLetter(request, me?.name || "Reviewer"));
    setError(null);
    setProgress(0);
    setIsUploading(false);
    setView("edit");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Live preview: the actual PDF, regenerated shortly after the last keystroke
  useEffect(() => {
    if (!open || !letter) return;
    let cancelled = false;
    setPreviewing(true);
    const t = setTimeout(async () => {
      try {
        const blob = await buildLetterPdf(letter);
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = url;
        setPreviewUrl(url);
      } catch {
        if (!cancelled) setError("The preview couldn't be generated. Check the letter text and try again.");
      } finally {
        if (!cancelled) setPreviewing(false);
      }
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [letter, open]);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    []
  );

  function set<K extends keyof LetterDraft>(key: K, value: LetterDraft[K]) {
    setLetter((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  const requiredMissing = !!letter && (!letter.recipientName.trim() || !letter.body.trim() || !letter.signatoryName.trim());

  /** Saves the letter as it currently reads, without uploading anything. */
  async function handleDownload() {
    if (!letter || isDownloading || isUploading) return;
    setIsDownloading(true);
    setError(null);
    try {
      const blob = await buildLetterPdf(letter);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = letterFileName(request);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError("The PDF couldn't be generated. Check the letter text and try again.");
    } finally {
      setIsDownloading(false);
    }
  }

  async function handleCreate() {
    if (!letter || isUploading || requiredMissing) return;
    setIsUploading(true);
    setError(null);
    setProgress(0);
    try {
      const blob = await buildLetterPdf(letter);
      const file = new File([blob], letterFileName(request), { type: "application/pdf" });
      await uploadProcessingFile({
        request,
        purpose: "final_approval_letter",
        file,
        onProgress: (p) => setProgress(p),
      });
      setProgress(100);
      // Stay loading until the refreshed request is back, so the page already shows the letter on close.
      await refreshRequest(request.id);
      toast.success(isReplacing ? "Approval letter replaced" : "Approval letter created", "The letter was generated, uploaded and verified.");
      onOpenChange(false);
    } catch (err: any) {
      console.error("Letter creation error:", err);
      if (err?.status === 409) {
        void refreshRequest(request.id, "none");
      }
      setError(err?.message || "The letter couldn't be uploaded. Please try again.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !isUploading && onOpenChange(o)}>
      <DialogContent className="flex h-[94svh] w-[calc(100vw-1rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4 pr-12">
          <DialogTitle className="flex items-center gap-2 font-heading text-xl font-medium">
            <FilePenLine className="size-5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
            {isReplacing ? "Create a new approval letter" : "Create approval letter"}
          </DialogTitle>
          <DialogDescription>
            Pre-filled from {request.code}, the resident and you. Edit anything, check the preview, then generate and upload.
          </DialogDescription>
        </DialogHeader>

        {/* Phone: switch between the form and the preview */}
        <div className="flex shrink-0 gap-1 border-b border-border p-2 lg:hidden" role="tablist" aria-label="Letter view">
          {(["edit", "preview"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium outline-none transition-colors",
                view === v ? "bg-primary/10 text-primary dark:bg-amber-400/15 dark:text-amber-300" : "text-muted-foreground"
              )}
            >
              {v === "edit" ? <FilePenLine className="size-4" /> : <Eye className="size-4" />}
              {v === "edit" ? "Edit" : "Preview"}
            </button>
          ))}
        </div>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
          {/* ------------------------------ form ------------------------------ */}
          <div className={cn("min-h-0 space-y-4 overflow-y-auto overscroll-contain p-5 lg:border-r lg:border-border", view === "preview" && "max-lg:hidden")}>
            {letter && (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <Field label="Date" htmlFor="lt-date">
                    <Input id="lt-date" value={letter.date} onChange={(e) => set("date", e.target.value)} />
                  </Field>
                  <Field label="Reference" htmlFor="lt-ref">
                    <Input id="lt-ref" value={letter.reference} onChange={(e) => set("reference", e.target.value)} />
                  </Field>
                </div>
                <Field label="Resident name" htmlFor="lt-name">
                  <Input id="lt-name" value={letter.recipientName} onChange={(e) => set("recipientName", e.target.value)} />
                </Field>
                <Field label="Property address" htmlFor="lt-addr">
                  <Input id="lt-addr" value={letter.recipientAddress} onChange={(e) => set("recipientAddress", e.target.value)} />
                </Field>
                <Field label="Subject" htmlFor="lt-subject">
                  <Input id="lt-subject" value={letter.subject} onChange={(e) => set("subject", e.target.value)} />
                </Field>
                <Field label="Salutation" htmlFor="lt-salutation">
                  <Input id="lt-salutation" value={letter.salutation} onChange={(e) => set("salutation", e.target.value)} />
                </Field>
                <Field label="Letter text" htmlFor="lt-body" hint="Leave a blank line between paragraphs.">
                  <Textarea id="lt-body" rows={9} value={letter.body} onChange={(e) => set("body", e.target.value)} />
                </Field>
                <Field label="Conditions of approval" htmlFor="lt-cond" hint="One condition per line. Clear it to omit the section.">
                  <Textarea id="lt-cond" rows={6} value={letter.conditions} onChange={(e) => set("conditions", e.target.value)} />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <Field label="Closing" htmlFor="lt-closing">
                    <Input id="lt-closing" value={letter.closing} onChange={(e) => set("closing", e.target.value)} />
                  </Field>
                  <Field label="Signed by" htmlFor="lt-signer">
                    <Input id="lt-signer" value={letter.signatoryName} onChange={(e) => set("signatoryName", e.target.value)} />
                  </Field>
                </div>
                <Field label="Signer's title" htmlFor="lt-title">
                  <Input id="lt-title" value={letter.signatoryTitle} onChange={(e) => set("signatoryTitle", e.target.value)} />
                </Field>
                <Field label="cc (optional)" htmlFor="lt-cc">
                  <Input id="lt-cc" value={letter.cc} onChange={(e) => set("cc", e.target.value)} placeholder="e.g. HOA management" />
                </Field>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground"
                  onClick={() => setLetter(buildDefaultLetter(request, me?.name || "Reviewer"))}
                  disabled={isUploading}
                >
                  <RotateCcw className="size-3.5" />
                  Reset to the standard letter
                </Button>
              </>
            )}
          </div>

          {/* ----------------------------- preview ---------------------------- */}
          <div className={cn("relative min-h-0 bg-muted/40", view === "edit" && "max-lg:hidden")}>
            {previewUrl ? (
              <iframe
                title="Letter preview"
                src={`${previewUrl}#toolbar=0&navpanes=0&view=FitH`}
                className="h-full w-full border-0"
              />
            ) : (
              <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                <Spinner className="size-4" /> Preparing preview…
              </div>
            )}
            {previewing && previewUrl && (
              <span className="absolute top-3 right-4 inline-flex items-center gap-1.5 rounded-full bg-card/90 px-2.5 py-1 text-[11px] text-muted-foreground shadow-xs">
                <Spinner className="size-3" /> Updating
              </span>
            )}
          </div>
        </div>

        <div className="shrink-0 space-y-2 border-t border-border bg-card px-5 py-3.5">
          {isUploading && <Progress value={progress} aria-label="Upload progress" />}
          {error && (
            <p role="alert" className="text-xs font-medium text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <FileText className="size-3.5" aria-hidden="true" />
              {letterFileName(request)} · stored and emailed to the resident when you complete the request
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleDownload}
                disabled={isUploading || isDownloading || !letter || requiredMissing}
                aria-label="Download PDF"
                title="Download PDF"
              >
                {isDownloading ? <Spinner className="size-4" /> : <Download className="size-4" />}
              </Button>
              <Button type="button" onClick={handleCreate} disabled={isUploading || !letter || requiredMissing}>
                {isUploading ? <Spinner className="mr-2 size-4" /> : <Send className="mr-2 size-4" />}
                {isUploading ? "Uploading…" : isReplacing ? "Generate & replace letter" : "Generate & upload letter"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
