"use client";

import { useState } from "react";
import { AlertTriangle, Ban, Banknote, Check, CheckCircle2, Clock, Eye, FileCheck2, Lock, Mail, ReceiptText, RefreshCw, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FilePicker, type PickedFile } from "@/components/shared/file-picker";
import type { PreviewableFile } from "@/components/shared/file-preview-dialog";
import { DepositChip, RefundChip } from "@/features/requests/components/request-chips";
import { completionGaps } from "@/features/requests/api/review.service";
import {
  useCompleteRequest,
  useMarkRefunded,
  useRecordReceipt,
  useRecordRefundOutcome,
  useResendApprovalEmail,
  useSetDeposit,
  useUploadLetter,
} from "@/hooks/use-reviewer-data";
import { useToast } from "@/hooks/use-toast";
import { REFUND_LABEL, depositDecided } from "@/lib/domain";
import { formatDateTime, formatFileSize } from "@/utils/format";
import { cn } from "@/utils/cn";

function StepCard({ step, title, subtitle, done, badge, children }: { step: number; title: string; subtitle?: string; done?: boolean; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="rounded-xl border border-border/70 bg-transparent shadow-none ring-0">
      <CardHeader className="border-b border-border/70 pb-3">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold",
              done ? "border-emerald-500 bg-emerald-500 text-white" : "border-border bg-card text-muted-foreground"
            )}
            aria-hidden="true"
          >
            {done ? <Check className="size-4" /> : step}
          </span>
          <div className="min-w-0 flex-1">
            <CardTitle className="font-heading text-lg font-medium">{title}</CardTitle>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          {badge}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">{children}</CardContent>
    </Card>
  );
}

const StaffOnly = () => (
  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-amber-900 uppercase dark:bg-amber-950/40 dark:text-amber-300">
    <Lock className="size-2.5" /> Staff only
  </span>
);

function FileRow({ label, file, onPreview }: { label: string; file: AttachedFile; onPreview: (f: PreviewableFile) => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/80 bg-muted/30 px-3.5 py-2.5">
      <FileCheck2 className="size-5 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{label}</p>
        <p className="truncate text-sm font-medium">{file.name}</p>
        <p className="text-[11px] text-muted-foreground">{formatFileSize(file.size)}</p>
      </div>
      <Button variant="outline" size="sm" onClick={() => onPreview(file)}>
        <Eye />
        Preview
      </Button>
    </div>
  );
}

/** Deposit → final letter → completion, for approved requests; refund handling for withdrawn ones. */
export function CompletionPanel({
  request,
  isOwner,
  onPreview,
}: {
  request: RequestRecord;
  isOwner: boolean;
  onPreview: (file: PreviewableFile) => void;
}) {
  const toast = useToast();
  const setDeposit = useSetDeposit();
  const recordReceipt = useRecordReceipt();
  const uploadLetter = useUploadLetter();
  const complete = useCompleteRequest();
  const resend = useResendApprovalEmail();
  const refundOutcome = useRecordRefundOutcome();
  const markRefunded = useMarkRefunded();

  const decided = depositDecided(request.deposit);
  const active = isOwner && request.status === "approved";
  const [choice, setChoice] = useState<"yes" | "no" | "">(request.deposit.required ? "yes" : request.deposit.confirmed ? "no" : "");
  const [amount, setAmount] = useState(request.deposit.amount ? String(request.deposit.amount) : "");
  const [amountError, setAmountError] = useState("");
  const [editingDeposit, setEditingDeposit] = useState(!decided);
  const [receipt, setReceipt] = useState<PickedFile | null>(null);
  const [letter, setLetter] = useState<PickedFile | null>(null);
  const [gaps, setGaps] = useState<string[]>([]);
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [refundChoice, setRefundChoice] = useState<"awaiting" | "no_refund" | "">("");
  const [outcomeProof, setOutcomeProof] = useState<PickedFile | null>(null);
  const [refundProof, setRefundProof] = useState<PickedFile | null>(null);
  const [confirmRefunded, setConfirmRefunded] = useState(false);

  const fail = (title: string) => (e: Error) => toast.error(title, e.message);

  function saveDeposit() {
    if (choice === "") return;
    if (choice === "no") {
      setDeposit.mutate(
        { requestId: request.id, required: false },
        { onSuccess: () => { setEditingDeposit(false); toast.success("Deposit not required"); }, onError: fail("Could not save") }
      );
      return;
    }
    const value = Number(amount.replace(/[^0-9.]/g, ""));
    if (!value || value <= 0) {
      setAmountError("Enter a deposit amount greater than zero.");
      return;
    }
    setDeposit.mutate(
      { requestId: request.id, required: true, amount: value },
      { onSuccess: () => { setEditingDeposit(false); toast.success("Deposit set", `$${value.toLocaleString()} — status Pending.`); }, onError: fail("Could not save") }
    );
  }

  /* ----------------------------- withdrawn ----------------------------- */
  if (request.status === "withdrawn") {
    const received = request.deposit.status === "received";
    const refund = request.refund;
    return (
      <div className="space-y-5">
        <StepCard step={1} title="Refund handling" subtitle="Deposits are refunded outside the app; partial-refund amounts are out of scope." done={!!refund && refund.outcome !== "awaiting"} badge={<StaffOnly />}>
          {!received ? (
            <p className="text-sm text-muted-foreground">
              {request.deposit.required
                ? "The deposit was never received, so no refund action is needed."
                : "No deposit was received on this request, so no refund action is needed."}
            </p>
          ) : (
            <>
              <dl className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <dt className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Deposit received</dt>
                  <dd className="font-mono text-lg font-bold">${request.deposit.amount?.toLocaleString()}</dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Refund outcome</dt>
                  <dd>{refund ? <RefundChip refund={refund} /> : <span className="text-sm font-medium text-amber-800 dark:text-amber-300">Not yet recorded</span>}</dd>
                </div>
              </dl>

              {!refund && isOwner && (
                <div className="space-y-3 border-t border-border/70 pt-4">
                  <p className="text-sm font-medium text-foreground">Record the applicable refund outcome</p>
                  <RadioGroup value={refundChoice} onValueChange={(v) => setRefundChoice(v as "awaiting" | "no_refund")} className="gap-2">
                    {[
                      { value: "awaiting", title: "Refund to be made", body: "Stays visible as awaiting refund action until you mark it Refunded." },
                      { value: "no_refund", title: "No Refund", body: "Refund not applicable / not agreed. A dash (“-”) is shown in the refund column." },
                    ].map((o) => (
                      <label
                        key={o.value}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
                          refundChoice === o.value ? "border-primary bg-primary/5 dark:border-amber-400 dark:bg-amber-400/5" : "border-border hover:border-foreground/30"
                        )}
                      >
                        <RadioGroupItem value={o.value} className="mt-0.5" />
                        <span>
                          <span className="block text-sm font-semibold">{o.title}</span>
                          <span className="block text-xs text-muted-foreground">{o.body}</span>
                        </span>
                      </label>
                    ))}
                  </RadioGroup>
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-foreground">Supporting document <span className="font-normal text-muted-foreground">(optional)</span></p>
                    <FilePicker value={outcomeProof} onChange={setOutcomeProof} accept=".pdf,image/*" label="Attach proof / supporting file" />
                  </div>
                  <Button
                    disabled={!refundChoice || refundOutcome.isPending}
                    onClick={() =>
                      refundOutcome.mutate(
                        { requestId: request.id, outcome: refundChoice as "awaiting" | "no_refund", proof: outcomeProof },
                        { onSuccess: () => toast.success("Refund outcome saved", "The resident has been notified through the portal and email."), onError: fail("Could not save") }
                      )
                    }
                  >
                    {refundOutcome.isPending && <Spinner className="size-4" />}
                    Save refund outcome
                  </Button>
                  <p className="text-[11px] text-muted-foreground">
                    Saving updates the resident&apos;s read-only refund information, adds the event to the request history and notifies them through the portal and email.
                  </p>
                </div>
              )}

              {refund?.outcome === "awaiting" && (
                <div className="space-y-3 border-t border-border/70 pt-4">
                  <p className="flex items-start gap-2 rounded-xl border border-amber-300/70 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800/70 dark:bg-amber-950/30 dark:text-amber-200">
                    <Clock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <span>Awaiting refund action since {formatDateTime(refund.date)}. Once the refund has been made outside the app, mark it Refunded.</span>
                  </p>
                  {refund.proof && <FileRow label="Refund proof" file={refund.proof} onPreview={onPreview} />}
                  {isOwner && (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold text-foreground">Proof of refund <span className="font-normal text-muted-foreground">(optional)</span></p>
                        <FilePicker value={refundProof} onChange={setRefundProof} accept=".pdf,image/*" label="Attach proof of refund" />
                      </div>
                      <Button onClick={() => setConfirmRefunded(true)} disabled={markRefunded.isPending}>
                        {markRefunded.isPending ? <Spinner className="size-4" /> : <Undo2 />}
                        Mark Refunded
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {refund?.outcome === "refunded" && (
                <div className="space-y-3">
                  <p className="rounded-xl border border-emerald-300/70 bg-emerald-50 p-3 text-sm text-emerald-950 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-200">
                    Refunded — recorded by {refund.recordedBy} on {formatDateTime(refund.date)}.
                  </p>
                  {refund.proof && <FileRow label="Refund proof" file={refund.proof} onPreview={onPreview} />}
                </div>
              )}

              {refund?.outcome === "no_refund" && (
                <div className="space-y-3">
                  <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">“-” means No Refund.</span> {refund.recordedBy} recorded on {formatDateTime(refund.date)} that a refund is not applicable or not agreed — it is not an unresolved refund. {REFUND_LABEL.no_refund}.
                  </p>
                  {refund.proof && <FileRow label="Supporting document" file={refund.proof} onPreview={onPreview} />}
                </div>
              )}
            </>
          )}
        </StepCard>

        {request.approvalLetter && request.completedAt && (
          <FileRow label="Issued approval letter (retained)" file={request.approvalLetter} onPreview={onPreview} />
        )}

        <ConfirmDialog
          open={confirmRefunded}
          onOpenChange={setConfirmRefunded}
          title="Mark this deposit as Refunded?"
          description="Confirm the refund has been made outside the app. Your name and today's date are recorded in the request history and the resident is notified through the portal and email."
          confirmLabel="Mark Refunded"
          onConfirm={() =>
            markRefunded.mutate({ requestId: request.id, proof: refundProof }, {
              onSuccess: () => { setRefundProof(null); toast.success("Marked Refunded", "The resident has been notified."); },
              onError: fail("Could not save"),
            })
          }
        />
      </div>
    );
  }

  /* ------------------- not yet approved / rejected --------------------- */
  if (request.status !== "approved" && request.status !== "completed") {
    return (
      <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-6 py-12 text-center">
        <Banknote className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
        <p className="mt-3 font-heading text-lg font-medium text-foreground">
          {request.status === "rejected" ? "No deposit or completion for a rejected request" : "Available once the request is approved"}
        </p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          {request.status === "rejected"
            ? "Rejected requests are closed. The rejection reason is kept in the request history."
            : "After approval you'll set whether a deposit is required, upload the final approval letter and mark the request Completed."}
        </p>
      </div>
    );
  }

  /* --------------------------- approved / completed --------------------------- */
  const requestGaps = completionGaps(request);
  const completed = request.status === "completed";
  const depositDone = request.deposit.required ? request.deposit.status === "received" : request.deposit.confirmed;

  return (
    <div className="space-y-5">
      {/* 1 — deposit */}
      <StepCard step={1} title="Deposit" subtitle="Payment happens outside the app. Deposit entry is reviewer-only; a payment receipt is optional." done={!!depositDone} badge={<StaffOnly />}>
        {active && editingDeposit && request.deposit.status !== "received" ? (
          <div className="space-y-4">
            <p className="text-sm font-medium text-foreground">
              Deposit required? <span className="text-destructive">*</span>
            </p>
            <RadioGroup value={choice} onValueChange={(v) => { setChoice(v as "yes" | "no"); setAmountError(""); }} className="grid gap-2 sm:grid-cols-2">
              {[
                { value: "no", title: "No", body: "Continue straight to the final approval letter." },
                { value: "yes", title: "Yes", body: "Enter an amount; status starts as Pending." },
              ].map((o) => (
                <label
                  key={o.value}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
                    choice === o.value ? "border-primary bg-primary/5 dark:border-amber-400 dark:bg-amber-400/5" : "border-border hover:border-foreground/30"
                  )}
                >
                  <RadioGroupItem value={o.value} className="mt-0.5" />
                  <span>
                    <span className="block text-sm font-semibold">{o.title}</span>
                    <span className="block text-xs text-muted-foreground">{o.body}</span>
                  </span>
                </label>
              ))}
            </RadioGroup>
            {choice === "yes" && (
              <div className="max-w-xs space-y-1.5">
                <label htmlFor="deposit-amount" className="block text-sm font-medium text-foreground">
                  Deposit amount <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <Input
                    id="deposit-amount"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => { setAmount(e.target.value); setAmountError(""); }}
                    placeholder="2,500"
                    aria-invalid={!!amountError}
                    className="pl-7 font-mono"
                  />
                </div>
                {amountError && <p className="text-xs text-destructive" role="alert">{amountError}</p>}
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={saveDeposit} disabled={!choice || setDeposit.isPending}>
                {setDeposit.isPending && <Spinner className="size-4" />}
                Save deposit setting
              </Button>
              {decided && (
                <Button variant="ghost" onClick={() => setEditingDeposit(false)}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
        ) : !decided ? (
          <p className="text-sm text-muted-foreground">The assigned reviewer sets whether a deposit is required after approval.</p>
        ) : !request.deposit.required ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">No deposit is required for this request.</p>
            {active && (
              <Button variant="outline" size="sm" onClick={() => { setChoice("no"); setEditingDeposit(true); }}>
                Change
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <dl className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1">
                <dt className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Amount</dt>
                <dd className="font-mono text-lg font-bold">${request.deposit.amount?.toLocaleString()}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Status</dt>
                <dd><DepositChip deposit={{ ...request.deposit, amount: undefined }} /></dd>
              </div>
              {request.deposit.receivedAt && (
                <div className="space-y-1">
                  <dt className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Received</dt>
                  <dd className="text-sm">{formatDateTime(request.deposit.receivedAt)}</dd>
                </div>
              )}
            </dl>

            {request.deposit.receipt && <FileRow label="Payment proof" file={request.deposit.receipt} onPreview={onPreview} />}

            {active && request.deposit.status === "pending" && (
              <div className="space-y-3 rounded-xl border border-border/80 bg-muted/20 p-4">
                <p className="text-sm font-medium text-foreground">Payment received? Mark the deposit Received — attaching a payment receipt is optional.</p>
                <FilePicker value={receipt} onChange={setReceipt} accept=".pdf,image/*" label="Attach payment proof (optional)" />
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={recordReceipt.isPending}
                    onClick={() =>
                      recordReceipt.mutate(
                        { requestId: request.id, file: receipt },
                        { onSuccess: () => { setReceipt(null); toast.success("Deposit received", receipt ? "Payment proof attached." : undefined); }, onError: fail("Could not save") }
                      )
                    }
                  >
                    {recordReceipt.isPending ? <Spinner className="size-4" /> : <ReceiptText />}
                    Mark deposit received
                  </Button>
                  <Button variant="ghost" onClick={() => { setChoice("yes"); setEditingDeposit(true); }}>
                    Edit deposit
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </StepCard>

      {/* 2 — final letter */}
      <StepCard step={2} title="Final approval letter" subtitle="Upload the ready-to-send letter. The system uses it as uploaded — it does not generate one." done={!!request.approvalLetter}>
        {request.approvalLetter && <FileRow label="Attached letter" file={request.approvalLetter} onPreview={onPreview} />}
        {request.approvalLetter && active && (
          <p className="text-xs text-muted-foreground">Check this is the correct file — this is what the resident receives. Replace it below if not.</p>
        )}
        {active ? (
          <div className="space-y-3">
            <FilePicker value={letter} onChange={setLetter} accept=".pdf,application/pdf" label={request.approvalLetter ? "Choose replacement letter" : "Choose approval letter (PDF)"} />
            {letter && (
              <Button
                disabled={uploadLetter.isPending}
                onClick={() =>
                  uploadLetter.mutate(
                    { requestId: request.id, file: letter },
                    { onSuccess: () => { setLetter(null); setGaps([]); toast.success(request.approvalLetter ? "Letter replaced" : "Letter uploaded"); }, onError: fail("Could not upload") }
                  )
                }
              >
                {uploadLetter.isPending && <Spinner className="size-4" />}
                {request.approvalLetter ? "Replace letter" : "Upload letter"}
              </Button>
            )}
          </div>
        ) : (
          !request.approvalLetter && <p className="text-sm text-muted-foreground">No final approval letter has been uploaded.</p>
        )}
      </StepCard>

      {/* 3 — complete */}
      <StepCard step={3} title="Mark completed" subtitle="Completing emails the final letter to the resident and makes it available in their portal." done={completed}>
        {completed ? (
          <div className="space-y-3">
            <p className="flex items-start gap-2 rounded-xl border border-teal-300/70 bg-teal-50 p-3 text-sm text-teal-950 dark:border-teal-900/70 dark:bg-teal-950/30 dark:text-teal-200">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>Completed on {request.completedAt ? formatDateTime(request.completedAt) : "—"}. The letter is available in the resident portal.</span>
            </p>
            <div className="flex flex-col gap-3 rounded-xl border border-emerald-300/70 bg-emerald-50 p-3 text-sm text-emerald-950 sm:flex-row sm:items-center sm:justify-between dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-200">
              <p className="flex items-center gap-2">
                <Mail className="size-4 shrink-0" aria-hidden="true" />
                <span>Approval letter emailed to the resident{request.letterEmail ? ` · last sent ${formatDateTime(request.letterEmail.at)}` : ""}.</span>
              </p>
              {isOwner && request.approvalLetter && (
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-card"
                  disabled={resend.isPending}
                  onClick={() =>
                    resend.mutate(request.id, {
                      onSuccess: () => toast.success("Email resent", "The approval letter was emailed to the resident again."),
                      onError: fail("Could not resend"),
                    })
                  }
                >
                  {resend.isPending ? <Spinner className="size-4" /> : <RefreshCw />}
                  Resend approval email
                </Button>
              )}
            </div>
            {request.approvalLetter && <FileRow label="Final approval letter" file={request.approvalLetter} onPreview={onPreview} />}
          </div>
        ) : (
          <div className="space-y-4">
            <ul className="space-y-2 text-sm">
              {[
                { ok: decided, label: "Deposit requirement answered" },
                ...(request.deposit.required ? [{ ok: request.deposit.status === "received", label: "Deposit marked received" }] : []),
                { ok: !!request.approvalLetter, label: "Final approval letter uploaded" },
              ].map((c) => (
                <li key={c.label} className="flex items-center gap-2">
                  <span className={cn("flex size-5 items-center justify-center rounded-full", c.ok ? "bg-emerald-500 text-white" : "border border-border bg-muted text-muted-foreground")}>
                    {c.ok ? <Check className="size-3" /> : <Ban className="size-3" />}
                  </span>
                  <span className={c.ok ? "text-foreground" : "text-muted-foreground"}>{c.label}</span>
                </li>
              ))}
            </ul>
            {gaps.length > 0 && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-300/70 bg-rose-50 p-3 text-sm text-rose-950 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200" role="alert">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-semibold">Can&apos;t complete yet — missing:</p>
                  <ul className="mt-1 list-disc pl-4">
                    {gaps.map((g) => (
                      <li key={g}>{g}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            {active && (
              <Button
                onClick={() => {
                  if (requestGaps.length > 0) return setGaps(requestGaps);
                  setGaps([]);
                  setConfirmComplete(true);
                }}
                disabled={complete.isPending}
              >
                {complete.isPending ? <Spinner className="size-4" /> : <CheckCircle2 />}
                Mark completed
              </Button>
            )}
          </div>
        )}
      </StepCard>

      <ConfirmDialog
        open={confirmComplete}
        onOpenChange={setConfirmComplete}
        title="Mark this request Completed?"
        description="The final approval letter is emailed to the resident automatically and made available in their portal. The completion is recorded in the request history."
        confirmLabel="Mark completed"
        loading={complete.isPending}
        onConfirm={() =>
          complete.mutate(request.id, {
            onSuccess: () => toast.success("Request completed", "The approval letter was emailed to the resident."),
            onError: (e: Error) => toast.error("Could not complete", e.message),
          })
        }
      />
    </div>
  );
}
