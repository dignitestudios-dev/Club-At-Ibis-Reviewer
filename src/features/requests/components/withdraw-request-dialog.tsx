"use client";

import { useState, useRef } from "react";
import { Ban, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useWithdrawRequest, keys } from "@/hooks/use-reviewer-data";

interface WithdrawRequestDialogProps {
  request: RequestRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WithdrawRequestDialog({ request, open, onOpenChange }: WithdrawRequestDialogProps) {
  const toast = useToast();
  const qc = useQueryClient();
  const withdrawMutation = useWithdrawRequest();
  const [acknowledged, setAcknowledged] = useState(false);
  const isSubmittingRef = useRef(false);

  function handleOpenChange(nextOpen: boolean) {
    if (withdrawMutation.isPending) return;
    if (!nextOpen) {
      setAcknowledged(false);
    }
    onOpenChange(nextOpen);
  }

  async function handleConfirmWithdrawal() {
    if (!acknowledged || isSubmittingRef.current || withdrawMutation.isPending) return;
    isSubmittingRef.current = true;

    try {
      await withdrawMutation.mutateAsync({
        requestId: request.id,
        residentContactAcknowledged: true,
        expectedAssignmentVersion: request.assignmentVersion ?? 0,
        expectedWorkflowVersion: request.workflowVersion ?? 1,
      });

      toast.success(
        "Request withdrawn",
        `Request ${request.code} has been marked as withdrawn per resident communication.`
      );
      handleOpenChange(false);
    } catch (err: any) {
      console.error("Withdraw request error:", err);
      if (err?.response?.status === 409) {
        toast.error("Conflict", "The request was updated elsewhere. Refreshed to latest state.");
        qc.invalidateQueries({ queryKey: keys.requestDetail(request.id) });
      } else {
        toast.error("Could not withdraw request", err?.response?.data?.message || err?.message || "An unexpected error occurred.");
      }
    } finally {
      isSubmittingRef.current = false;
    }
  }

  const depositWasReceived = request.deposit?.status === "received";
  const isCompleted = request.status === "completed";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md w-full max-w-[calc(100vw-2rem)] overflow-hidden">
        <DialogHeader className="min-w-0">
          <div className="mb-1 flex size-10 items-center justify-center rounded-xl border border-rose-300/80 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300">
            <Ban className="size-5" aria-hidden="true" />
          </div>
          <DialogTitle className="font-heading text-xl font-medium break-words [overflow-wrap:anywhere]">
            Withdraw Request
          </DialogTitle>
          <DialogDescription className="break-words [overflow-wrap:anywhere]">
            Record a resident withdrawal for request{" "}
            <span className="font-mono font-semibold text-foreground break-all">{request.code}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border border-amber-300/80 bg-amber-50/50 p-3.5 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300 space-y-1.5 break-words [overflow-wrap:anywhere]">
            <p className="font-semibold flex items-center gap-1.5">
              <AlertTriangle className="size-3.5 shrink-0" /> Important Consequences
            </p>
            <ul className="list-disc list-inside space-y-1 text-amber-900/90 dark:text-amber-300/90 pl-1">
              <li>This request will be marked as <strong>Withdrawn</strong> and review will cease.</li>
              {isCompleted && (
                <li>Any previously issued final approval letter remains safely recorded on file.</li>
              )}
              {depositWasReceived && (
                <li>
                  Because a deposit was collected, a <strong>Refund Outcome</strong> will be required.
                </li>
              )}
            </ul>
          </div>

          <div className="flex items-start space-x-2.5 rounded-xl border border-border/80 bg-muted/20 p-3.5">
            <Checkbox
              id="ack-resident-contact"
              checked={acknowledged}
              onCheckedChange={(checked) => setAcknowledged(!!checked)}
              disabled={withdrawMutation.isPending}
              className="mt-0.5"
            />
            <Label
              htmlFor="ack-resident-contact"
              className="text-xs font-normal leading-relaxed text-foreground cursor-pointer"
            >
              I confirm that the resident contacted staff outside the portal to request withdrawal of this application. <span className="text-destructive">*</span>
            </Label>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={withdrawMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-rose-600 hover:bg-rose-700 text-white dark:bg-rose-600 dark:hover:bg-rose-700"
            onClick={handleConfirmWithdrawal}
            disabled={!acknowledged || withdrawMutation.isPending}
          >
            {withdrawMutation.isPending ? <Spinner className="size-4 mr-2" /> : <Ban className="size-4 mr-2" />}
            Confirm Withdrawal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
