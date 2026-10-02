"use client";

import { useState, useRef } from "react";
import { CheckCircle2, AlertTriangle, FileCheck2, DollarSign, XCircle, Send } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useCompleteRequest } from "@/hooks/use-reviewer-data";

interface CompleteRequestDialogProps {
  request: RequestRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenDepositDialog?: () => void;
  onOpenLetterDialog?: () => void;
}

export function CompleteRequestDialog({
  request,
  open,
  onOpenChange,
  onOpenDepositDialog,
  onOpenLetterDialog,
}: CompleteRequestDialogProps) {
  const toast = useToast();
  const qc = useQueryClient();
  const completeMutation = useCompleteRequest();
  const isSubmittingRef = useRef(false);

  // Prerequisites
  const hasLetter = !!(request.approvalLetter || request.completion?.finalApprovalLetter);
  const depositIsConfigured =
    request.deposit?.status === "not_required" ||
    (request.deposit?.required === false) ||
    (request.deposit?.required === true && request.deposit?.status === "received");

  const depositNeedsReceipt =
    request.deposit?.required === true && request.deposit?.status === "pending";
  const depositNeedsConfig =
    !request.deposit?.confirmed && request.deposit?.status === "pending" && !request.deposit?.required;

  const allPrerequisitesMet = hasLetter && depositIsConfigured;

  async function handleConfirmCompletion() {
    if (isSubmittingRef.current || completeMutation.isPending || !allPrerequisitesMet) return;
    isSubmittingRef.current = true;

    try {
      const idempotencyKey = `complete-${request.id}-${Date.now()}`;
      await completeMutation.mutateAsync({
        requestId: request.id,
        expectedAssignmentVersion: request.assignmentVersion ?? 0,
        expectedWorkflowVersion: request.workflowVersion ?? 1,
        idempotencyKey,
      });

      toast.success(
        "Request completed",
        `Request ${request.code} is marked as completed and final letter has been released to the resident.`
      );
      qc.invalidateQueries({ queryKey: ["requests", request.id] });
      qc.invalidateQueries({ queryKey: ["requests"] });
      onOpenChange(false);
    } catch (err: any) {
      console.error("Complete request error:", err);
      if (err?.response?.status === 409) {
        toast.error("Conflict", "The request was updated in another session. Refreshed to latest state.");
        qc.invalidateQueries({ queryKey: ["requests", request.id] });
      } else {
        toast.error("Could not complete request", err?.response?.data?.message || err?.message || "An unexpected error occurred.");
      }
    } finally {
      isSubmittingRef.current = false;
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !completeMutation.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg w-full max-w-[calc(100vw-2rem)] overflow-hidden">
        <DialogHeader className="min-w-0">
          <div className="mb-1 flex size-10 items-center justify-center rounded-xl border border-emerald-300/80 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
            <CheckCircle2 className="size-5" aria-hidden="true" />
          </div>
          <DialogTitle className="font-heading text-xl font-medium break-words [overflow-wrap:anywhere]">
            Complete Request
          </DialogTitle>
          <DialogDescription className="break-words [overflow-wrap:anywhere]">
            Review prerequisites and finalize request{" "}
            <span className="font-mono font-semibold text-foreground break-all">{request.code}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Prerequisites Checklist */}
          <div className="rounded-xl border border-border/80 bg-muted/20 p-3.5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Completion Prerequisites
            </p>

            {/* Prerequisite 1: Deposit Requirement */}
            <div className="flex items-start justify-between gap-3 text-xs">
              <div className="flex items-start gap-2 min-w-0">
                {depositIsConfigured ? (
                  <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <p className="font-medium text-foreground">Deposit Requirement</p>
                  <p className="text-muted-foreground mt-0.5 break-words [overflow-wrap:anywhere]">
                    {request.deposit?.status === "not_required" || request.deposit?.required === false
                      ? "No deposit required for this request."
                      : request.deposit?.status === "received"
                      ? `Deposit received ($${Number(request.deposit.amount || 0).toLocaleString()}) with verified receipt.`
                      : depositNeedsReceipt
                      ? `Deposit of $${Number(request.deposit?.amount || 0).toLocaleString()} requires payment receipt.`
                      : "Deposit requirement must be configured."}
                  </p>
                </div>
              </div>
              {!depositIsConfigured && onOpenDepositDialog && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs shrink-0"
                  onClick={() => {
                    onOpenChange(false);
                    onOpenDepositDialog();
                  }}
                >
                  Configure
                </Button>
              )}
            </div>

            {/* Prerequisite 2: Final Approval Letter */}
            <div className="flex items-start justify-between gap-3 text-xs">
              <div className="flex items-start gap-2 min-w-0">
                {hasLetter ? (
                  <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <p className="font-medium text-foreground">Final Approval Letter</p>
                  <p className="text-muted-foreground mt-0.5 break-words [overflow-wrap:anywhere]">
                    {hasLetter
                      ? `Letter uploaded (${request.approvalLetter?.name || request.completion?.finalApprovalLetter?.name || "Ready"}).`
                      : "Final approval letter must be uploaded before completion."}
                  </p>
                </div>
              </div>
              {!hasLetter && onOpenLetterDialog && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs shrink-0"
                  onClick={() => {
                    onOpenChange(false);
                    onOpenLetterDialog();
                  }}
                >
                  Upload
                </Button>
              )}
            </div>
          </div>

          {/* Outcome Summary */}
          {allPrerequisitesMet ? (
            <div className="rounded-xl border border-emerald-300/80 bg-emerald-50/50 p-3.5 text-xs text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300 space-y-1.5 break-words [overflow-wrap:anywhere]">
              <p className="font-semibold flex items-center gap-1.5">
                <Send className="size-3.5" /> Finalization & Delivery
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-emerald-900/90 dark:text-emerald-300/90 pl-1">
                <li>Request status will change to <strong>Completed</strong>.</li>
                <li>The final approval letter will be released for the resident to view and download.</li>
                <li>An automated completion email will be queued for the resident.</li>
              </ul>
            </div>
          ) : (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2 break-words [overflow-wrap:anywhere]">
              <XCircle className="size-4 shrink-0 mt-0.5" />
              <span>
                Please complete all missing prerequisites before completing this request.
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={completeMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-600 dark:hover:bg-emerald-700"
            onClick={handleConfirmCompletion}
            disabled={!allPrerequisitesMet || completeMutation.isPending}
          >
            {completeMutation.isPending ? <Spinner className="size-4 mr-2" /> : <CheckCircle2 className="size-4 mr-2" />}
            Confirm Completion
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
