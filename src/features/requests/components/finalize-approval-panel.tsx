"use client";

import { useState } from "react";
import {
  Ban,
  Banknote,
  CheckCircle2,
  Circle,
  Eye,
  FileCheck2,
  Pencil,
  RefreshCw,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateTime, formatFileSize } from "@/utils/format";
import { cn } from "@/utils/cn";
import { DepositDialog } from "./deposit-dialog";
import { formatDepositAmount, isDepositConfigured } from "./deposit-fields";
// import { CreateLetterDialog } from "./create-letter-dialog"; // letter creation is off for now
import { UploadLetterDialog } from "./upload-letter-dialog";
import { UploadReceiptDialog } from "./upload-receipt-dialog";
import { MarkReceivedButton } from "./mark-received-button";

function Step({
  done,
  title,
  children,
  action,
}: {
  done: boolean;
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
      <span className="mt-0.5 shrink-0" aria-hidden="true">
        {done ? (
          <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <Circle className="size-5 text-amber-500 dark:text-amber-400" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">
          {title}
          <span className="sr-only">{done ? " — done" : " — to do"}</span>
        </p>
        <div className="mt-0.5 text-xs text-muted-foreground sm:text-sm">{children}</div>
      </div>
      {action && <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{action}</div>}
    </li>
  );
}

/**
 * Everything a reviewer has to do after approving, in one place and in order:
 * deposit → (receipt) → final letter → complete. Replaces the scattered banner, tab cards and sticky bar.
 */
export function FinalizeApprovalPanel({
  request,
  canWithdraw,
  onWithdraw,
  onComplete,
  onPreviewFile,
}: {
  request: RequestRecord;
  canWithdraw: boolean;
  onWithdraw: () => void;
  onComplete: () => void;
  onPreviewFile: (file: AttachedFile) => void;
}) {
  const [depositOpen, setDepositOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [replacingReceipt, setReplacingReceipt] = useState(false);
  const [letterOpen, setLetterOpen] = useState(false);
  // const [composeOpen, setComposeOpen] = useState(false); // letter creation is off for now
  const [replacingLetter, setReplacingLetter] = useState(false);

  const deposit = request.deposit;
  const depositConfigured = isDepositConfigured(deposit);
  const depositRequired = depositConfigured && deposit?.required === true;
  const receiptReceived = deposit?.status === "received";

  const letter = request.approvalLetter || request.completion?.finalApprovalLetter;

  // Steps that count towards completion
  const depositDone = depositConfigured && (!depositRequired || receiptReceived);
  const letterDone = !!letter;
  const doneCount = 1 + (depositDone ? 1 : 0) + (letterDone ? 1 : 0); // approval itself is step 1
  const total = 3;
  const canComplete = depositDone && letterDone;

  const missing = [
    !depositConfigured ? "set the deposit" : depositRequired && !receiptReceived ? "mark the deposit as received" : null,
    !letterDone ? "upload the final approval letter" : null,
  ].filter(Boolean) as string[];

  return (
    <section
      id="finalize-panel"
      aria-label="Finalize approved request"
      className="scroll-mt-20 overflow-hidden rounded-2xl border border-emerald-300/80 bg-card shadow-2xs dark:border-emerald-900/70"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-200/80 bg-emerald-50 px-4 py-3.5 sm:px-5 dark:border-emerald-900/60 dark:bg-emerald-950/30">
        <div className="min-w-0">
          <h2 className="font-heading text-lg font-medium text-emerald-950 dark:text-emerald-200">Finish up this approval</h2>
          <p className="text-xs text-emerald-900/80 dark:text-emerald-300/80">
            {canComplete
              ? "Everything is ready — complete the request to release the letter to the resident."
              : "Complete these steps, then mark the request as completed."}
          </p>
        </div>
        <div className="flex items-center gap-2" aria-label={`${doneCount} of ${total} steps done`}>
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-emerald-200/70 dark:bg-emerald-900/60" aria-hidden="true">
            <div className="h-full rounded-full bg-emerald-600 transition-all duration-300 dark:bg-emerald-400" style={{ width: `${(doneCount / total) * 100}%` }} />
          </div>
          <span className="text-xs font-semibold tabular-nums text-emerald-900 dark:text-emerald-300">
            {doneCount}/{total}
          </span>
        </div>
      </header>

      <ol className="divide-y divide-border/70">
        <Step done title="Approved">
          {request.decidedAt ? `Approved on ${formatDate(request.decidedAt)}. ` : ""}The resident has been notified.
        </Step>

        <Step
          done={depositDone}
          title="Deposit"
          action={
            <>
              {!depositConfigured && (
                <Button type="button" size="sm" onClick={() => setDepositOpen(true)}>
                  <Banknote className="size-3.5" />
                  Set deposit
                </Button>
              )}
              {depositConfigured && !receiptReceived && (
                <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => setDepositOpen(true)}>
                  <Pencil className="size-3.5" />
                  Edit
                </Button>
              )}
              {depositRequired && !receiptReceived && <MarkReceivedButton request={request} />}
              {depositRequired && !deposit?.receipt && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    setReplacingReceipt(false);
                    setReceiptOpen(true);
                  }}
                >
                  <UploadCloud className="size-3.5" />
                  Attach receipt (optional)
                </Button>
              )}
              {receiptReceived && deposit?.receipt && (
                <>
                  <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => onPreviewFile(deposit.receipt!)}>
                    <Eye className="size-3.5" />
                    View receipt
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      setReplacingReceipt(true);
                      setReceiptOpen(true);
                    }}
                  >
                    <Pencil className="size-3.5" />
                    Edit receipt
                  </Button>
                </>
              )}
            </>
          }
        >
          {!depositConfigured ? (
            "Not saved yet — tick the box if a deposit is needed, then save."
          ) : !depositRequired ? (
            "No deposit required."
          ) : receiptReceived ? (
            <>
              {formatDepositAmount(deposit?.amount) ? `${formatDepositAmount(deposit?.amount)} deposit` : "Deposit"} received
              {deposit?.receivedAt ? ` · ${formatDateTime(deposit.receivedAt)}` : ""}.{!deposit?.receipt && " No receipt attached."}
            </>
          ) : (
            <>
              {formatDepositAmount(deposit?.amount) ? `${formatDepositAmount(deposit?.amount)} deposit required` : "Deposit required"} — mark it as received once paid. Attaching a receipt is optional.
            </>
          )}
        </Step>

        <Step
          done={letterDone}
          title="Final approval letter"
          action={
            letter ? (
              <>
                <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => onPreviewFile(letter)}>
                  <Eye className="size-3.5" />
                  Preview
                </Button>
                {/* Letter creation is switched off for now (letters are upload-only). Code kept for later: re-enable by restoring the buttons, the dialog below, the import and the state.
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    setReplacingLetter(true);
                    setComposeOpen(true);
                  }}
                >
                  <FilePenLine className="size-3.5" />
                  New letter
                </Button>
                */}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    setReplacingLetter(true);
                    setLetterOpen(true);
                  }}
                >
                  <RefreshCw className="size-3.5" />
                  Replace file
                </Button>
              </>
            ) : (
              <>
                {/*
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setReplacingLetter(false);
                    setComposeOpen(true);
                  }}
                >
                  <FilePenLine className="size-3.5" />
                  Create letter
                </Button>
                */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setReplacingLetter(false);
                    setLetterOpen(true);
                  }}
                >
                  <UploadCloud className="size-3.5" />
                  Upload file
                </Button>
              </>
            )
          }
        >
          {letter ? (
            <span className="inline-flex flex-wrap items-center gap-x-1.5">
              <FileCheck2 className="size-3.5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
              <span className="max-w-[16rem] truncate font-medium text-foreground" title={letter.name}>
                {letter.name || "Final Approval Letter"}
              </span>
              <span>· {formatFileSize(letter.size)}</span>
            </span>
          ) : (
            "Upload the signed final letter (PDF or image). The resident sees it once the request is completed."
          )}
        </Step>
      </ol>

      <footer className="flex flex-col gap-3 border-t border-border/70 bg-muted/30 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <p className={cn("text-xs sm:text-sm", canComplete ? "text-emerald-800 dark:text-emerald-300" : "text-muted-foreground")}>
          {canComplete
            ? "Completing sends the approval letter to the resident by email."
            : `Still to do: ${missing.join(" and ")}.`}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {canWithdraw && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="text-xs"
              onClick={onWithdraw}
            >
              <Ban className="size-3.5" />
              Withdraw
            </Button>
          )}
          <Button
            type="button"
            className="bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700"
            onClick={onComplete}
            disabled={!canComplete}
            title={canComplete ? undefined : `Still to do: ${missing.join(" and ")}.`}
          >
            <CheckCircle2 className="size-4" />
            Complete request
          </Button>
        </div>
      </footer>

      <DepositDialog request={request} open={depositOpen} onOpenChange={setDepositOpen} />
      <UploadReceiptDialog request={request} open={receiptOpen} onOpenChange={setReceiptOpen} isReplacing={replacingReceipt} />
      {/* <CreateLetterDialog request={request} open={composeOpen} onOpenChange={setComposeOpen} isReplacing={replacingLetter} /> */}
      <UploadLetterDialog request={request} open={letterOpen} onOpenChange={setLetterOpen} isReplacing={replacingLetter} />
    </section>
  );
}
