"use client";

import { Mail, RefreshCw, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useRetryCompletionEmail } from "@/hooks/use-reviewer-data";
import { formatDateTime } from "@/utils/format";

interface EmailStatusCardProps {
  request: RequestRecord;
  isOwner: boolean;
}

export function EmailStatusCard({ request, isOwner }: EmailStatusCardProps) {
  const toast = useToast();
  const qc = useQueryClient();
  const retryMutation = useRetryCompletionEmail();

  const emailRecord = request.completion?.email;
  const letterEmail = request.letterEmail;

  // Fallback status if email record is not structured
  const status: EmailDeliveryStatus =
    emailRecord?.status || (letterEmail ? "SENT" : "PENDING");

  async function handleRetryEmail() {
    try {
      await retryMutation.mutateAsync({
        requestId: request.id,
        expectedAssignmentVersion: request.assignmentVersion ?? 0,
        expectedWorkflowVersion: request.workflowVersion ?? 1,
      });

      toast.success("Retry queued", "Completion email delivery has been re-queued.");
      qc.invalidateQueries({ queryKey: ["requests", request.id] });
      qc.invalidateQueries({ queryKey: ["requests"] });
    } catch (err: any) {
      if (err?.response?.status === 409) {
        toast.error("Conflict", "The request was updated elsewhere. Refreshed to latest state.");
        qc.invalidateQueries({ queryKey: ["requests", request.id] });
      } else {
        toast.error("Failed to retry email delivery", err?.response?.data?.message || err?.message);
      }
    }
  }

  return (
    <Card className="rounded-xl border border-border/70 bg-transparent shadow-none ring-0">
      <CardHeader className="border-b border-border/70 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="font-heading text-lg font-medium flex items-center gap-2">
              <Mail className="size-5 text-emerald-600 dark:text-emerald-400" />
              Completion Email Notification
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Automated delivery of the final approval package to the resident.
            </p>
          </div>
          {isOwner && status === "FAILED" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRetryEmail}
              disabled={retryMutation.isPending}
              className="h-8 gap-1.5 text-xs text-destructive hover:bg-destructive/10 border-destructive/40"
            >
              {retryMutation.isPending ? <Spinner className="size-3.5" /> : <RefreshCw className="size-3.5" />}
              Retry Delivery
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-4">
        {status === "SENT" && (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-300/70 bg-emerald-50/60 p-3.5 text-xs text-emerald-950 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300">
            <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold">Email Successfully Delivered</p>
              <p className="text-emerald-900/80 dark:text-emerald-300/80 mt-0.5">
                Sent to resident on{" "}
                {emailRecord?.sentAt
                  ? formatDateTime(emailRecord.sentAt)
                  : letterEmail?.at
                  ? formatDateTime(letterEmail.at)
                  : "completion"}
                .
              </p>
            </div>
          </div>
        )}

        {status === "PENDING" && (
          <div className="flex items-center gap-3 rounded-xl border border-border/80 bg-muted/30 p-3.5 text-xs text-muted-foreground">
            <Clock className="size-5 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold text-foreground">Queued for Delivery</p>
              <p className="mt-0.5">
                The completion email is in the outbound queue and will be processed shortly.
              </p>
            </div>
          </div>
        )}

        {status === "PROCESSING" && (
          <div className="flex items-center gap-3 rounded-xl border border-sky-300/70 bg-sky-50/60 p-3.5 text-xs text-sky-950 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-300">
            <Spinner className="size-5 text-sky-600 dark:text-sky-400 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold">Sending Outbox Email...</p>
              <p className="text-sky-900/80 dark:text-sky-300/80 mt-0.5">
                Delivery attempt in progress with email server.
              </p>
            </div>
          </div>
        )}

        {status === "FAILED" && (
          <div className="rounded-xl border border-rose-300/70 bg-rose-50/60 p-3.5 text-xs text-rose-950 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-300 space-y-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <p className="font-semibold">Delivery Failed</p>
            </div>
            {emailRecord?.lastErrorMessage && (
              <p className="text-rose-900/80 dark:text-rose-300/80 break-words [overflow-wrap:anywhere] pl-6">
                {emailRecord.lastErrorMessage}
                {emailRecord.lastErrorCode && ` (${emailRecord.lastErrorCode})`}
              </p>
            )}
            {emailRecord?.attemptCount != null && emailRecord.attemptCount > 0 && (
              <p className="text-[11px] text-muted-foreground pl-6">
                Attempts: {emailRecord.attemptCount} · Cycle: {emailRecord.retryCycle || 1}
              </p>
            )}
          </div>
        )}

        {status === "CANCELED" && (
          <div className="flex items-center gap-3 rounded-xl border border-border/80 bg-muted/30 p-3.5 text-xs text-muted-foreground">
            <AlertCircle className="size-5 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold text-foreground">Delivery Canceled</p>
              <p className="mt-0.5">The notification was canceled before completion delivery.</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
