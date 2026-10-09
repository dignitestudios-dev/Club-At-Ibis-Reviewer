"use client";

import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { useRecordDepositReceived } from "@/hooks/use-reviewer-data";

/** Marks the required deposit as received. A receipt file is optional and can be attached separately. */
export function MarkReceivedButton({ request, variant = "default" }: { request: RequestRecord; variant?: "default" | "outline" }) {
  const toast = useToast();
  const mutation = useRecordDepositReceived();

  async function handleClick() {
    try {
      await mutation.mutateAsync({
        requestId: request.id,
        expectedAssignmentVersion: request.assignmentVersion ?? 0,
        expectedWorkflowVersion: request.workflowVersion ?? 1,
      });
      toast.success("Deposit marked as received");
    } catch (err: any) {
      // A 409 is reloaded and announced by useRequestMutation.
      if ((err?.statusCode ?? err?.response?.status) !== 409) {
        toast.error("Could not mark deposit as received", err?.message);
      }
    }
  }

  return (
    <Button type="button" size="sm" variant={variant} onClick={handleClick} disabled={mutation.isPending}>
      {mutation.isPending ? <Spinner className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
      Mark as received
    </Button>
  );
}
