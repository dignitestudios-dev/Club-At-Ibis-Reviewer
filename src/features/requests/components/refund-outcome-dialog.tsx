"use client";

import { useCloseOnConflict } from "@/hooks/use-close-on-conflict";
import { formatDepositAmount } from "./deposit-fields";
import { useState, useEffect, useRef } from "react";
import { DollarSign, CheckCircle2, AlertCircle, Minus, Calendar } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useSetRefundOutcome, keys } from "@/hooks/use-reviewer-data";

interface RefundOutcomeDialogProps {
  request: RequestRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isCorrecting?: boolean;
}

export function RefundOutcomeDialog({
  request,
  open,
  onOpenChange,
  isCorrecting = false,
}: RefundOutcomeDialogProps) {
  useCloseOnConflict(open, () => onOpenChange(false));
  const toast = useToast();
  const qc = useQueryClient();
  const setRefundMutation = useSetRefundOutcome();
  const isSubmittingRef = useRef(false);

  const [outcome, setOutcome] = useState<"refunded" | "no_refund">(
    request.refund?.outcome === "refunded" ? "refunded" : "no_refund"
  );
  const [refundDate, setRefundDate] = useState<string>(
    request.refund?.refundDate || request.refund?.date ? (request.refund.refundDate || request.refund.date || "").substring(0, 10) : new Date().toISOString().substring(0, 10)
  );
  const [correctionReason, setCorrectionReason] = useState<string>(
    request.refund?.correctionReason || ""
  );
  const [dateError, setDateError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (request.refund?.outcome === "refunded") {
        setOutcome("refunded");
      } else if (request.refund?.outcome === "no_refund") {
        setOutcome("no_refund");
      } else {
        setOutcome("refunded");
      }

      const defaultDate = request.refund?.refundDate || request.refund?.date
        ? (request.refund.refundDate || request.refund.date || "").substring(0, 10)
        : new Date().toISOString().substring(0, 10);
      setRefundDate(defaultDate);
      setCorrectionReason(request.refund?.correctionReason || "");
      setDateError(null);
    }
  }, [open, request.refund]);

  function validate(): boolean {
    if (outcome === "refunded") {
      if (!refundDate || !/^\d{4}-\d{2}-\d{2}$/.test(refundDate)) {
        setDateError("Please enter a valid refund date (YYYY-MM-DD).");
        return false;
      }
      const today = new Date().toISOString().substring(0, 10);
      if (refundDate > today) {
        setDateError("Refund date cannot be in the future.");
        return false;
      }
    }
    setDateError(null);
    return true;
  }

  async function handleSubmit() {
    if (!validate() || isSubmittingRef.current || setRefundMutation.isPending) return;
    isSubmittingRef.current = true;

    try {
      await setRefundMutation.mutateAsync({
        requestId: request.id,
        expectedAssignmentVersion: request.assignmentVersion ?? 0,
        expectedWorkflowVersion: request.workflowVersion ?? 1,
        outcome,
        refundDate: outcome === "refunded" ? refundDate : undefined,
        correctionReason: isCorrecting ? correctionReason.trim() : undefined,
      });

      toast.success(
        isCorrecting ? "Refund outcome corrected" : "Refund outcome recorded",
        outcome === "refunded"
          ? `Refund recorded on ${refundDate}.`
          : "Recorded as No Refund applicable."
      );
      onOpenChange(false);
    } catch (err: any) {
      console.error("Refund outcome error:", err);
      if ((err?.statusCode ?? err?.response?.status) === 409) {
        // Reloaded + toast shown by useRequestMutation; the dialog closes so the fresh data is what's on screen.
        onOpenChange(false);
      } else {
        toast.error("Could not record refund outcome", err?.response?.data?.message || err?.message || "An unexpected error occurred.");
      }
    } finally {
      isSubmittingRef.current = false;
    }
  }

  return (
    <Dialog disablePointerDismissal open={open} onOpenChange={(o) => !setRefundMutation.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md w-full max-w-[calc(100vw-2rem)]">
        <DialogHeader className="min-w-0">
          <div className="mb-1 flex size-10 items-center justify-center rounded-xl border border-amber-300/80 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
            <DollarSign className="size-5" aria-hidden="true" />
          </div>
          <DialogTitle className="font-heading text-xl font-medium break-words [overflow-wrap:anywhere]">
            {isCorrecting ? "Correct Refund Outcome" : "Record Refund Outcome"}
          </DialogTitle>
          <DialogDescription className="break-words [overflow-wrap:anywhere]">
            Record the final disposition of the deposit for request{" "}
            <span className="font-mono font-semibold text-foreground break-all">{request.code}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-4">
          <div className="rounded-xl border border-border/80 bg-muted/20 p-3 text-xs space-y-1">
            <p className="text-muted-foreground">Original Deposit Collected:</p>
            <p className="font-mono text-base font-bold text-foreground">
              {formatDepositAmount(request.deposit?.amount) ?? "Amount not specified"}
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold text-foreground">
              Select Refund Outcome <span className="text-destructive">*</span>
            </Label>
            <RadioGroup
              value={outcome}
              onValueChange={(val) => {
                setOutcome(val as "refunded" | "no_refund");
                if (val === "no_refund") setDateError(null);
              }}
              className="space-y-2 pt-1"
            >
              <div className="flex items-start space-x-3 rounded-xl border border-border/80 p-3 hover:bg-muted/20 cursor-pointer">
                <RadioGroupItem value="refunded" id="ref-refunded" className="mt-0.5" />
                <Label htmlFor="ref-refunded" className="cursor-pointer flex-1 font-normal">
                  <span className="font-medium text-foreground block">Deposit Refunded</span>
                  <span className="text-xs text-muted-foreground block mt-0.5">
                    The security deposit was returned or disbursed to the resident.
                  </span>
                </Label>
              </div>

              <div className="flex items-start space-x-3 rounded-xl border border-border/80 p-3 hover:bg-muted/20 cursor-pointer">
                <RadioGroupItem value="no_refund" id="ref-no-refund" className="mt-0.5" />
                <Label htmlFor="ref-no-refund" className="cursor-pointer flex-1 font-normal">
                  <span className="font-medium text-foreground block">No Refund</span>
                  <span className="text-xs text-muted-foreground block mt-0.5">
                    No refund is due, or the deposit was retained.
                  </span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {outcome === "refunded" && (
            <div className="space-y-1.5">
              <Label htmlFor="refund-date" className="text-sm font-medium">
                Disbursement / Refund Date <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="refund-date"
                  type="date"
                  max={new Date().toISOString().substring(0, 10)}
                  value={refundDate}
                  onChange={(e) => {
                    setRefundDate(e.target.value);
                    if (dateError) setDateError(null);
                  }}
                  className="font-mono text-sm"
                />
              </div>
              {dateError && (
                <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                  <AlertCircle className="size-3.5 shrink-0" />
                  {dateError}
                </p>
              )}
            </div>
          )}

          {isCorrecting && (
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="correction-reason" className="text-sm font-medium">
                Reason for Correction <span className="text-xs text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                id="correction-reason"
                placeholder="e.g. Resident requested check reissuance / date updated to actual check clearance."
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                maxLength={500}
                rows={2}
                className="text-xs resize-none"
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={setRefundMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-600 dark:hover:bg-amber-700"
            onClick={handleSubmit}
            disabled={setRefundMutation.isPending}
          >
            {setRefundMutation.isPending ? <Spinner className="size-4 mr-2" /> : <CheckCircle2 className="size-4 mr-2" />}
            {isCorrecting ? "Save Correction" : "Save Outcome"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
