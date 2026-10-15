"use client";

import { useRef } from "react";
import { BadgeCheck } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { useCloseOnConflict } from "@/hooks/use-close-on-conflict";
import { useMarkPermitInUse } from "@/hooks/use-reviewer-data";

interface MarkPermitDialogProps {
  request: RequestRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MarkPermitDialog({ request, open, onOpenChange }: MarkPermitDialogProps) {
  useCloseOnConflict(open, () => onOpenChange(false));
  const toast = useToast();
  const mutation = useMarkPermitInUse();
  const submittingRef = useRef(false);

  async function handleConfirm() {
    if (submittingRef.current || mutation.isPending) return;
    submittingRef.current = true;
    try {
      await mutation.mutateAsync({
        requestId: request.id,
        expectedAssignmentVersion: request.assignmentVersion ?? 0,
        expectedWorkflowVersion: request.workflowVersion ?? 1,
      });
      toast.success("Permit marked as in use", `The permit for ${request.code} is now in use.`);
      onOpenChange(false);
    } catch (err: any) {
      if ((err?.statusCode ?? err?.response?.status) === 409) {
        // Reloaded + toast shown by useRequestMutation; close so the fresh data is on screen.
        onOpenChange(false);
      } else {
        toast.error("Could not mark permit", err?.message || "An unexpected error occurred.");
      }
    } finally {
      submittingRef.current = false;
    }
  }

  return (
    <Dialog disablePointerDismissal open={open} onOpenChange={(o) => !mutation.isPending && onOpenChange(o)}>
      <DialogContent className="w-full max-w-[calc(100vw-2rem)] sm:max-w-md">
        <DialogHeader className="min-w-0">
          <div className="mb-1 flex size-10 items-center justify-center rounded-xl border border-sky-300/80 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-300">
            <BadgeCheck className="size-5" aria-hidden="true" />
          </div>
          <DialogTitle className="font-heading text-xl font-medium">Mark permit as in use</DialogTitle>
          <DialogDescription className="break-words [overflow-wrap:anywhere]">
            Record that the permit for{" "}
            <span className="font-mono font-semibold text-foreground break-all">{request.code}</span> is in use.
          </DialogDescription>
        </DialogHeader>

        <ul className="list-inside list-disc space-y-1 rounded-xl border border-border/80 bg-muted/20 p-3.5 text-xs text-muted-foreground">
          <li>This cannot be undone and is recorded in the request history.</li>
          <li>It does not extend the permit&apos;s validity.</li>
          <li>Reminders and the automatic expiry still continue.</li>
        </ul>

        <DialogFooter className="gap-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={mutation.isPending}>
            {mutation.isPending && <Spinner className="mr-2 size-4" />}
            Mark as in use
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
