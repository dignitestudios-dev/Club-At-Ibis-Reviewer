"use client";

import { useCloseOnConflict } from "@/hooks/use-close-on-conflict";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Banknote } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { useSetDepositRequirement, keys } from "@/hooks/use-reviewer-data";
import { DepositFields, depositPayload, formatDepositAmount, isDepositConfigured, validateDeposit, type DepositValue } from "./deposit-fields";

/** Set or change the security-deposit requirement of an approved request. */
export function DepositDialog({
  request,
  open,
  onOpenChange,
}: {
  request: RequestRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  useCloseOnConflict(open, () => onOpenChange(false));
  const toast = useToast();
  const qc = useQueryClient();
  const mutation = useSetDepositRequirement();

  const configured = isDepositConfigured(request.deposit);

  const [value, setValue] = useState<DepositValue>({ required: false, amount: "" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setValue({
      required: configured ? (request.deposit?.required ?? false) : false,
      amount: request.deposit?.amount != null ? Number(request.deposit.amount).toFixed(2) : "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleSave() {
    const problem = validateDeposit(value);
    if (problem) {
      setError(problem);
      return;
    }
    try {
      await mutation.mutateAsync({
        requestId: request.id,
        expectedAssignmentVersion: request.assignmentVersion ?? 0,
        expectedWorkflowVersion: request.workflowVersion ?? 1,
        ...depositPayload(value),
      });
      toast.success(
        "Deposit saved",
        value.required ? `Deposit${formatDepositAmount(value.amount) ? ` of ${formatDepositAmount(value.amount)}` : ""} recorded.` : "Marked as no deposit required."
      );
      onOpenChange(false);
    } catch (err: any) {
      if ((err?.statusCode ?? err?.response?.status) === 409) {
        // Reloaded + toast shown by useRequestMutation; the dialog closes so the fresh data is what's on screen.
        onOpenChange(false);
      } else {
        toast.error("Could not save deposit", err?.response?.data?.message || err?.message);
      }
    }
  }

  return (
    <Dialog disablePointerDismissal open={open} onOpenChange={(o) => !mutation.isPending && onOpenChange(o)}>
      <DialogContent className="w-full max-w-[calc(100vw-2rem)] sm:max-w-lg">
        <DialogHeader>
          <div className="mb-1 flex size-10 items-center justify-center rounded-xl border border-amber-300/80 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
            <Banknote className="size-5" aria-hidden="true" />
          </div>
          <DialogTitle className="font-heading text-xl font-medium">Security deposit</DialogTitle>
          <DialogDescription>Tick the box only if this project needs a security deposit. Otherwise it stays as no deposit.</DialogDescription>
        </DialogHeader>

        <DepositFields value={value} onChange={(v) => { setValue(v); setError(null); }} error={error} disabled={mutation.isPending} />

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={mutation.isPending}>
            {mutation.isPending ? <Spinner className="mr-2 size-4" /> : <CheckCircle2 className="mr-2 size-4" />}
            Save deposit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
