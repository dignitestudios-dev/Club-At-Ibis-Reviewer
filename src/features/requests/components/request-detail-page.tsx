"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  Eye,
  FileCheck2,
  FileDiff,
  FileEdit,
  FileText,
  Flag,
  History,
  LayoutTemplate,
  Lock,
  Mail,
  PlayCircle,
  ReceiptText,
  UserRoundPlus,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { FieldHelpTooltip } from "@/components/shared/field-help-tooltip";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { StatusBadge } from "@/components/shared/status-badge";
import { FilePreviewDialog, type PreviewableFile } from "@/components/shared/file-preview-dialog";
import { getReviewerFileDownloadUrl } from "@/features/requests/api/requests.service";
import { AssignReviewerDialog } from "@/features/requests/components/assign-reviewer-dialog";
import { EarlierSubmissions } from "@/features/requests/components/earlier-submissions";
import { HistoryTimeline } from "@/features/requests/components/history-timeline";
import { RequestJourney } from "@/features/requests/components/request-journey";
import { DepositChip, RefundChip } from "@/features/requests/components/request-chips";
import { ReviewItem } from "@/features/requests/components/review-item";
import {
  ApproveRequestDialog,
  RejectRequestDialog,
  RequestRevisionDialog,
} from "@/features/requests/components/decision-dialogs";
import {
  useApproveRequest,
  useAssessReviewItems,
  useAssignRequest,
  useCategories,
  useRejectRequest,
  useRequest,
  useRequestRevision,
  useResidents,
  useReviewers,
  useStartReview,
} from "@/hooks/use-reviewer-data";
import { useMe } from "@/hooks/use-current-user";
import { useToast } from "@/hooks/use-toast";
import {
  IN_FLIGHT,
  REFUND_LABEL,
  changedFieldIds,
  currentSubmissionNumber,
  earlierSubmissions,
  needsRefundOutcome,
  residentFullName,
} from "@/lib/domain";
import { formatDate, formatDateTime, formatFileSize } from "@/utils/format";

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{label}</dt>
      <dd className="text-sm text-foreground break-words [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

function StaffFile({
  label,
  file,
  staffOnly,
  onPreview,
}: {
  label: string;
  file: AttachedFile;
  staffOnly?: boolean;
  onPreview: (file: AttachedFile) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/80 bg-muted/30 px-3.5 py-2.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card">
        <FileText className="size-4 text-rose-600" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          {label}
          {staffOnly && (
            <span className="rounded-full bg-amber-50 px-1.5 py-px text-[9px] text-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
              Staff only
            </span>
          )}
        </p>
        <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
      </div>
      <Button variant="outline" size="sm" onClick={() => onPreview(file)}>
        <Eye />
        Preview
      </Button>
    </div>
  );
}

function getPreviousFieldValue(request: RequestRecord, fieldId: string): string | undefined {
  if (request.submissions && request.submissions.length > 1) {
    const prevSub = request.submissions[request.submissions.length - 2];
    if (prevSub && prevSub.fieldValues[fieldId] !== undefined) {
      return prevSub.fieldValues[fieldId];
    }
  }
  const rev = request.revisions.find((r) => r.fieldId === fieldId);
  return rev?.previous;
}

export default function RequestDetailPage({ id }: { id: string }) {
  const toast = useToast();
  const qc = useQueryClient();
  const { me, isDefault } = useMe();
  const { data: req, isLoading } = useRequest(id);
  const { data: residents } = useResidents();
  const { data: reviewers } = useReviewers(undefined, { enabled: isDefault });
  const { data: categories } = useCategories();

  const takeOwnership = useAssignRequest();
  const startReviewMutation = useStartReview();
  const assessItemsMutation = useAssessReviewItems();
  const requestRevisionMutation = useRequestRevision();
  const approveMutation = useApproveRequest();
  const rejectMutation = useRejectRequest();

  const [activeTab, setActiveTab] = useState("overview");
  const [preview, setPreview] = useState<PreviewableFile | null>(null);
  const [assigning, setAssigning] = useState<RequestRecord | null>(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [isProcessingDecision, setIsProcessingDecision] = useState(false);
  const [isAssessingField, setIsAssessingField] = useState(false);

  if (isLoading || !me) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  const isOwner = !!req && req.assignedReviewerId === me.id;
  const backHref = isOwner || !isDefault ? "/my-requests" : "/oversight";

  if (!req || (!isOwner && !isDefault)) {
    return (
      <EmptyState
        icon={req ? Lock : FileText}
        title={req ? "This request isn't assigned to you" : "Request not found"}
        description={
          req
            ? "You can open requests that are assigned to you. If it was reassigned, the new owner now has authority over it."
            : "This request doesn't exist or the link is no longer valid."
        }
        action={
          <Button nativeButton={false} render={<Link href="/my-requests" />}>
            Back to my requests
          </Button>
        }
      />
    );
  }

  const resident = req.resident
    ? {
        id: req.resident.id,
        residentIdNumber: req.resident.residentId || req.resident.residentIdNumber || "",
        firstName: req.resident.firstName || "",
        lastName: req.resident.lastName || "",
        displayName: req.resident.displayName || "",
        email: req.resident.email || "",
        phone: req.resident.phone || "",
        active: true,
        address: req.property?.address || req.fieldValues?.propertyAddress || "",
        lotNo: req.property?.lotNo || req.fieldValues?.lotNo || "",
        createdAt: "",
      }
    : residents?.find((r) => r.id === req.residentId);
  const owner = isOwner ? me : reviewers?.find((r) => r.id === req.assignedReviewerId);
  const category = categories?.find((c) => c.id === req.categoryId);
  const currentCategoryVersion = category?.version ?? req.formVersion;

  const infoFields = (req.formSnapshot || []).filter((f) => f.type !== "file").sort((a, b) => a.order - b.order);
  const fileFields = (req.formSnapshot || []).filter((f) => f.type === "file").sort((a, b) => a.order - b.order);
  // Fields without a `source` (shouldn't happen, but the field is optional in
  // the type) default into Project Information rather than silently vanishing.
  const projectInfoFields = infoFields.filter((f) => f.source !== "category");
  const categoryInfoFields = infoFields.filter((f) => f.source === "category");
  const docCount = fileFields.reduce((n, f) => n + (req.uploads?.[f.id]?.length ?? 0), 0);
  const flaggedCount = Object.values(req.itemReviews || {}).filter((r) => r.state === "flagged").length;
  const changedIds = changedFieldIds(req);
  const earlierRounds = earlierSubmissions(req);

  const canOwnIncoming = isDefault && !req.assignedReviewerId && IN_FLIGHT.includes(req.status);
  const refundAlert = needsRefundOutcome(req) || req.refund?.outcome === "awaiting";

  const propAddress = req.property?.address || req.fieldValues?.propertyAddress || "—";
  const propLot = req.property?.lotNo || req.fieldValues?.lotNo || "—";

  const canStartReview = isOwner && req.status === "assigned";
  const canReview = isOwner && ["under_review", "resubmitted"].includes(req.status);

  /* ------------------------------ handlers ----------------------------- */

  async function handleStartReview() {
    if (!req) return;
    try {
      await startReviewMutation.mutateAsync({
        requestId: req.id,
        expectedAssignmentVersion: req.assignmentVersion ?? 0,
        expectedWorkflowVersion: req.workflowVersion ?? 1,
      });
      toast.success("Review started", `Review round for ${req.code} is now active.`);
    } catch (err: any) {
      if (err?.response?.status === 409) {
        toast.error("Conflict", "The request was updated in another session. Refreshed to latest state.");
        qc.invalidateQueries({ queryKey: ["requests", req.id] });
      } else {
        toast.error("Could not start review", err.message || "An unexpected error occurred.");
      }
    }
  }

  async function handleSaveFlag(fieldId: string, reason: string) {
    if (!req) return;
    setIsAssessingField(true);
    try {
      await assessItemsMutation.mutateAsync({
        requestId: req.id,
        expectedAssignmentVersion: req.assignmentVersion ?? 0,
        expectedWorkflowVersion: req.workflowVersion ?? 1,
        expectedReviewVersion: req.review?.reviewVersion ?? 0,
        items: [{ field: fieldId, decision: "flagged", reason }],
      });
      toast.success("Field flagged", "The correction note has been recorded.");
    } catch (err: any) {
      if (err?.response?.status === 409) {
        toast.error("Conflict", "The review was updated in another session. Refreshed.");
        qc.invalidateQueries({ queryKey: ["requests", req.id] });
      } else {
        toast.error("Could not flag field", err.message || "An unexpected error occurred.");
      }
      throw err;
    } finally {
      setIsAssessingField(false);
    }
  }

  async function handleClearFlag(field: CategoryField) {
    if (!req) return;
    setIsAssessingField(true);
    try {
      await assessItemsMutation.mutateAsync({
        requestId: req.id,
        expectedAssignmentVersion: req.assignmentVersion ?? 0,
        expectedWorkflowVersion: req.workflowVersion ?? 1,
        expectedReviewVersion: req.review?.reviewVersion ?? 0,
        items: [{ field: field.id, decision: "accepted" }],
      });
      toast.success("Flag cleared", `${field.label} is marked as accepted.`);
    } catch (err: any) {
      if (err?.response?.status === 409) {
        toast.error("Conflict", "The review was updated in another session. Refreshed.");
        qc.invalidateQueries({ queryKey: ["requests", req.id] });
      } else {
        toast.error("Could not update field", err.message || "An unexpected error occurred.");
      }
      throw err;
    } finally {
      setIsAssessingField(false);
    }
  }

  async function handleSaveFileFlag(fileId: string, reason: string) {
    if (!req) return;
    setIsAssessingField(true);
    try {
      await assessItemsMutation.mutateAsync({
        requestId: req.id,
        expectedAssignmentVersion: req.assignmentVersion ?? 0,
        expectedWorkflowVersion: req.workflowVersion ?? 1,
        expectedReviewVersion: req.review?.reviewVersion ?? 0,
        items: [{ field: `file:${fileId}`, decision: "flagged", reason }],
      });
      toast.success("Document flagged", "The correction note has been recorded.");
    } catch (err: any) {
      if (err?.response?.status === 409) {
        toast.error("Conflict", "The review was updated in another session. Refreshed.");
        qc.invalidateQueries({ queryKey: ["requests", req.id] });
      } else {
        toast.error("Could not flag document", err.message || "An unexpected error occurred.");
      }
      throw err;
    } finally {
      setIsAssessingField(false);
    }
  }

  async function handleClearFileFlag(fileId: string) {
    if (!req) return;
    setIsAssessingField(true);
    try {
      await assessItemsMutation.mutateAsync({
        requestId: req.id,
        expectedAssignmentVersion: req.assignmentVersion ?? 0,
        expectedWorkflowVersion: req.workflowVersion ?? 1,
        expectedReviewVersion: req.review?.reviewVersion ?? 0,
        items: [{ field: `file:${fileId}`, decision: "accepted" }],
      });
      toast.success("Flag cleared", "The document is marked as accepted.");
    } catch (err: any) {
      if (err?.response?.status === 409) {
        toast.error("Conflict", "The review was updated in another session. Refreshed.");
        qc.invalidateQueries({ queryKey: ["requests", req.id] });
      } else {
        toast.error("Could not update document", err.message || "An unexpected error occurred.");
      }
      throw err;
    } finally {
      setIsAssessingField(false);
    }
  }

  async function handleApprove() {
    if (!req) return;
    setIsProcessingDecision(true);
    try {
      let currentReviewVersion = req.review?.reviewVersion ?? 0;
      // Auto-accept any items still in pending state, in one atomic batch —
      // using item.key (not fieldId) so file-kind items resolve correctly.
      const pendingItems = (req.review?.items || []).filter((it) => it.decision === "pending");
      if (pendingItems.length > 0) {
        const updated = await assessItemsMutation.mutateAsync({
          requestId: req.id,
          expectedAssignmentVersion: req.assignmentVersion ?? 0,
          expectedWorkflowVersion: req.workflowVersion ?? 1,
          expectedReviewVersion: currentReviewVersion,
          items: pendingItems.map((item) => ({ field: item.key || item.fieldId, decision: "accepted" as const })),
        });
        currentReviewVersion = updated.review?.reviewVersion ?? currentReviewVersion + 1;
      }

      await approveMutation.mutateAsync({
        requestId: req.id,
        expectedAssignmentVersion: req.assignmentVersion ?? 0,
        expectedWorkflowVersion: req.workflowVersion ?? 1,
        expectedReviewVersion: currentReviewVersion,
      });
      toast.success("Request approved", `${req.code} has been approved successfully.`);
      setApproveOpen(false);
    } catch (err: any) {
      if (err?.response?.status === 409) {
        toast.error("Conflict", "The request was updated in another session. Refreshed.");
        qc.invalidateQueries({ queryKey: ["requests", req.id] });
      } else {
        toast.error("Could not approve request", err.message || "An unexpected error occurred.");
      }
    } finally {
      setIsProcessingDecision(false);
    }
  }

  async function handleRequestRevision() {
    if (!req) return;
    setIsProcessingDecision(true);
    try {
      let currentReviewVersion = req.review?.reviewVersion ?? 0;
      // Auto-accept any unflagged items still in pending state, in one
      // atomic batch — using item.key (not fieldId) so file-kind items
      // resolve correctly.
      const pendingItems = (req.review?.items || []).filter((it) => it.decision === "pending");
      if (pendingItems.length > 0) {
        const updated = await assessItemsMutation.mutateAsync({
          requestId: req.id,
          expectedAssignmentVersion: req.assignmentVersion ?? 0,
          expectedWorkflowVersion: req.workflowVersion ?? 1,
          expectedReviewVersion: currentReviewVersion,
          items: pendingItems.map((item) => ({ field: item.key || item.fieldId, decision: "accepted" as const })),
        });
        currentReviewVersion = updated.review?.reviewVersion ?? currentReviewVersion + 1;
      }

      await requestRevisionMutation.mutateAsync({
        requestId: req.id,
        expectedAssignmentVersion: req.assignmentVersion ?? 0,
        expectedWorkflowVersion: req.workflowVersion ?? 1,
        expectedReviewVersion: currentReviewVersion,
      });
      toast.success("Revision requested", `Resident notified to submit corrections for ${req.code}.`);
      setRevisionOpen(false);
    } catch (err: any) {
      if (err?.response?.status === 409) {
        toast.error("Conflict", "The request was updated in another session. Refreshed.");
        qc.invalidateQueries({ queryKey: ["requests", req.id] });
      } else {
        toast.error("Could not request revision", err.message || "An unexpected error occurred.");
      }
    } finally {
      setIsProcessingDecision(false);
    }
  }

  async function handleReject(reason: string) {
    if (!req) return;
    setIsProcessingDecision(true);
    try {
      await rejectMutation.mutateAsync({
        requestId: req.id,
        expectedAssignmentVersion: req.assignmentVersion ?? 0,
        expectedWorkflowVersion: req.workflowVersion ?? 1,
        expectedReviewVersion: req.review?.reviewVersion ?? 0,
        reason,
      });
      toast.success("Request rejected", `${req.code} has been rejected.`);
      setRejectOpen(false);
    } catch (err: any) {
      if (err?.response?.status === 409) {
        toast.error("Conflict", "The request was updated in another session. Refreshed.");
        qc.invalidateQueries({ queryKey: ["requests", req.id] });
      } else {
        toast.error("Could not reject request", err.message || "An unexpected error occurred.");
      }
    } finally {
      setIsProcessingDecision(false);
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-16">
      {/* Header */}
      <div className="space-y-4">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {backHref === "/my-requests" ? "My assigned requests" : "Request oversight"}
        </Link>
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-2xl font-medium text-foreground break-words [overflow-wrap:anywhere] sm:text-3xl">
              {req.code}
            </h1>
            <StatusBadge status={req.status} />
            {currentSubmissionNumber(req) > 1 && (
              <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-[11px] font-bold tracking-wider text-purple-800 uppercase dark:bg-purple-950/60 dark:text-purple-300">
                Submission #{currentSubmissionNumber(req)}
              </span>
            )}
            {earlierRounds.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab("submissionHistory")}
                className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-card px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary dark:hover:text-amber-300"
              >
                <History className="size-3" aria-hidden="true" />
                {earlierRounds.length} earlier round{earlierRounds.length === 1 ? "" : "s"}
              </button>
            )}
            {isOwner ? (
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold tracking-wider text-primary uppercase dark:bg-primary/20 dark:text-amber-300">
                Assigned to you
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                <Lock className="size-3" aria-hidden="true" /> Read-only
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground">
            <span className="min-w-0 max-w-full font-medium text-foreground break-words [overflow-wrap:anywhere]">
              {req.categoryName}
            </span>
            {category?.status === "archived" && (
              <span className="rounded-full bg-slate-200 px-2 py-px text-[10px] font-bold tracking-wider text-slate-700 uppercase dark:bg-slate-700 dark:text-slate-200">
                Archived category
              </span>
            )}
            <span aria-hidden="true">·</span>
            <span className="min-w-0 max-w-full break-words [overflow-wrap:anywhere]">{propAddress}</span>
            <span aria-hidden="true">·</span>
            <span className="min-w-0 max-w-full break-words [overflow-wrap:anywhere]">{propLot}</span>
          </div>
        </div>
      </div>

      {/* Start Review banner */}
      {canStartReview && (
        <div className="flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-primary/40 dark:bg-primary/10">
          <div className="flex items-start gap-3 text-sm">
            <PlayCircle className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <p className="font-semibold text-foreground">Request is assigned and ready for review</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Start the review round to assess submitted fields and documents.
              </p>
            </div>
          </div>
          <Button
            disabled={startReviewMutation.isPending}
            onClick={handleStartReview}
            className="shrink-0"
          >
            {startReviewMutation.isPending ? <Spinner className="size-4 mr-2" /> : <PlayCircle className="size-4 mr-2" />}
            Start Review
          </Button>
        </div>
      )}

      {/* Active Review banner */}
      {canReview && (
        <div className="flex flex-col gap-2 rounded-2xl border border-emerald-300/70 bg-emerald-50/50 p-4 dark:border-emerald-900/70 dark:bg-emerald-950/20 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 text-sm">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 font-bold text-xs text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
              R{req.review?.roundNumber ?? 1}
            </span>
            <div>
              <p className="font-semibold text-foreground">
                Active Review · Round #{req.review?.roundNumber ?? 1}
              </p>
              <p className="text-xs text-muted-foreground">
                All fields are accepted by default. Click &ldquo;Flag for revision&rdquo; on any items requiring corrections.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium">
            <span className="rounded-full bg-card border px-2.5 py-1 text-foreground">
              Total fields: {infoFields.length}
            </span>
            {flaggedCount > 0 ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-900 dark:bg-amber-950/60 dark:text-amber-300">
                {flaggedCount} flagged
              </span>
            ) : (
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300">
                0 flagged (ready to approve)
              </span>
            )}
          </div>
        </div>
      )}

      {/* Ownership / assignment banner. Default reviewers get the assign/reassign
          action here — not duplicated in the "Assigned reviewer" summary card
          below — for every in-flight request, including ones already assigned
          to themselves; non-default reviewers viewing an unassigned request
          only ever see the take-ownership option. */}
      {IN_FLIGHT.includes(req.status) && (!isOwner || isDefault) && (
        <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 text-sm">
            <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <p className="text-muted-foreground">
              {owner ? (
                isOwner ? (
                  <>
                    Assigned to <span className="font-semibold text-foreground">you</span>. As a default reviewer you can reassign it if needed.
                  </>
                ) : (
                  <>
                    Assigned to <span className="font-semibold text-foreground">{owner.name}</span>. As a default reviewer you can reassign it if needed.
                  </>
                )
              ) : req.status === "submitted" ? (
                "Waiting in the incoming list. Take ownership to handle it, or assign it to another reviewer."
              ) : (
                "This request has no assigned reviewer."
              )}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {canOwnIncoming && (
              <Button
                disabled={takeOwnership.isPending}
                onClick={() =>
                  takeOwnership.mutate(
                    { requestId: req.id, reviewerId: me.id },
                    {
                      onSuccess: () => toast.success("Ownership taken", `${req.code} is now yours.`),
                      onError: (e: Error) => toast.error("Could not take ownership", e.message),
                    }
                  )
                }
              >
                {takeOwnership.isPending ? <Spinner className="size-4" /> : <PlayCircle />}
                Take ownership
              </Button>
            )}
            {isDefault && (
              <Button variant="outline" onClick={() => setAssigning(req)}>
                <UserRoundPlus />
                {owner ? "Reassign" : "Assign"}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Status alerts */}
      {refundAlert && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-300/80 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-amber-950 dark:text-amber-200">
              {needsRefundOutcome(req) ? "Refund outcome needed" : "Awaiting refund action"}
            </p>
            <p className="text-amber-900/80 dark:text-amber-300/80">
              {needsRefundOutcome(req)
                ? "The resident withdrew after a deposit was received. Refund happens outside the application."
                : "The refund action is pending completion outside the application."}
            </p>
          </div>
        </div>
      )}
      {req.status === "withdrawn" && !refundAlert && (
        <div className="flex items-start gap-3 rounded-2xl border border-slate-300/80 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
          <Ban className="mt-0.5 size-5 shrink-0 text-slate-600 dark:text-slate-300" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-semibold text-foreground">
              Withdrawn by resident {req.withdrawnAt && `on ${formatDate(req.withdrawnAt)}`}
            </p>
            <p className="text-muted-foreground">
              Review processing stopped
              {req.withdrawnFrom && ` (withdrawn while ${req.withdrawnFrom.replace("_", " ")})`}. Documents, earlier decisions and history are preserved.
            </p>
          </div>
        </div>
      )}

      <RequestJourney request={req} />

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="shadow-2xs h-full flex flex-col justify-center">
          <CardContent className="space-y-2 py-2 flex flex-1 flex-col justify-center">
            <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Resident</p>
            {resident ? (
              <div className="flex items-center gap-3">
                <PersonAvatar name={residentFullName(resident)} className="size-10" />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-foreground">{residentFullName(resident)}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {resident.residentIdNumber} · {resident.email}
                  </span>
                  {resident.phone && <span className="block truncate text-xs text-muted-foreground">{resident.phone}</span>}
                </span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Unknown resident</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-2xs h-full flex flex-col justify-center">
          <CardContent className="space-y-2 py-2 flex flex-1 flex-col justify-center">
            <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Assigned reviewer</p>
            {owner ? (
              <div className="flex items-center gap-3">
                <PersonAvatar name={owner.name} className="size-10" />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-foreground">
                    {owner.name}
                    {isOwner && <span className="font-normal text-muted-foreground"> (you)</span>}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{owner.designation}</span>
                </span>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Unassigned</p>
                <p className="text-xs text-muted-foreground">
                  {req.status === "withdrawn" ? "Withdrawn before assignment." : "Waiting in the incoming list."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-2xs h-full flex flex-col justify-center">
          <CardContent className="space-y-2 py-2 flex flex-1 flex-col justify-center">
            <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Key dates</p>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Submitted</dt>
                <dd className="font-medium">{formatDate(req.submittedAt)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Last update</dt>
                <dd className="font-medium">{formatDate(req.updatedAt)}</dd>
              </div>
              {req.decidedAt && (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Decision</dt>
                  <dd className="font-medium">{formatDate(req.decidedAt)}</dd>
                </div>
              )}
              {req.completedAt && (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Completed</dt>
                  <dd className="font-medium">{formatDate(req.completedAt)}</dd>
                </div>
              )}
              {req.withdrawnAt && (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Withdrawn</dt>
                  <dd className="font-medium">{formatDate(req.withdrawnAt)}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        <Card className="shadow-2xs h-full flex flex-col justify-center">
          <CardContent className="space-y-2 py-2 flex flex-1 flex-col justify-center">
            <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Form configuration</p>
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary dark:text-amber-300">
                <LayoutTemplate className="size-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">Submitted on form v{req.formVersion}</p>
                <p className="flex items-center text-xs text-muted-foreground">
                  {req.formVersion === currentCategoryVersion
                    ? "Matches current form"
                    : `Category is now v${currentCategoryVersion}`}
                  {req.formVersion !== currentCategoryVersion && (
                    <FieldHelpTooltip content="This request keeps the form and data it was submitted with; later edits only apply to new requests." />
                  )}
                </p>
              </div>
            </div>
            {req.formVersion !== currentCategoryVersion && (
              <Link
                href={`/forms/${req.categoryId}?v=${req.formVersion}`}
                className="inline-block text-xs font-medium text-primary hover:underline dark:text-amber-300"
              >
                Compare with current version
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Card className="shadow-2xs">
        <CardContent className="pt-1">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as string)}>
            <TabsList aria-label="Request sections">
              <TabsTrigger value="overview">Latest Submission</TabsTrigger>
              <TabsTrigger value="decisions">Decisions &amp; deposit</TabsTrigger>
              <TabsTrigger value="history">
                Activity timeline{req.history.length > 0 ? ` (${req.history.length})` : ""}
              </TabsTrigger>
              {earlierRounds.length > 0 && (
                <TabsTrigger value="submissionHistory">
                  Submission History ({earlierRounds.length})
                </TabsTrigger>
              )}
            </TabsList>

            {/* Latest submission: project info + category-specific fields, kept
                separate from earlier rounds (see the Submission History tab)
                so a reviewer always knows they're looking at what the resident
                has to fix right now, not a mix of old and new answers. */}
            <TabsContent value="overview" className="space-y-5 pt-4">
              <div
                className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-sm ${
                  req.formVersion === currentCategoryVersion
                    ? "border-border bg-muted/30"
                    : "border-teal-300/70 bg-teal-50 dark:border-teal-800/70 dark:bg-teal-950/30"
                }`}
              >
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="inline-flex items-center gap-1.5">
                    <LayoutTemplate className="size-4 text-muted-foreground" aria-hidden="true" />
                    Submitted on <span className="font-semibold text-foreground">form v{req.formVersion}</span>
                  </span>
                  <span className="text-muted-foreground">
                    Latest version: <span className="font-semibold text-foreground">v{currentCategoryVersion}</span>
                  </span>
                  {req.formVersion === currentCategoryVersion && (
                    <span className="text-xs text-muted-foreground">Up to date</span>
                  )}
                </p>
                {req.formVersion !== currentCategoryVersion && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-card"
                    nativeButton={false}
                    render={<Link href={`/forms/${req.categoryId}?v=${req.formVersion}`} />}
                  >
                    <FileDiff />
                    What changed
                  </Button>
                )}
              </div>

              <Card className="rounded-xl border border-border/70 bg-transparent shadow-none ring-0">
                <CardHeader className="border-b border-border/70 pb-3">
                  <CardTitle className="font-heading text-lg font-medium">Project Information</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Property and project details shared by every category (form v{req.formVersion}).
                    {canReview && " All fields are accepted by default; flag any items requiring resident corrections."}
                  </p>
                </CardHeader>
                <CardContent className="pt-5 space-y-4">
                  {projectInfoFields.map((field) => (
                    <ReviewItem
                      key={field.id}
                      request={req}
                      field={field}
                      canReview={canReview}
                      changed={changedIds.has(field.id)}
                      previous={getPreviousFieldValue(req, field.id)}
                      onPreview={setPreview}
                      onSaveFlag={(fieldId, reason) => handleSaveFlag(fieldId, reason)}
                      onClearFlag={(f) => handleClearFlag(f)}
                      isAssessing={isAssessingField}
                    />
                  ))}
                </CardContent>
              </Card>

              {categoryInfoFields.length > 0 && (
                <Card className="rounded-xl border border-border/70 bg-transparent shadow-none ring-0">
                  <CardHeader className="border-b border-border/70 pb-3">
                    <CardTitle className="font-heading text-lg font-medium">{req.categoryName} Details</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Fields specific to this category&apos;s form.
                      {canReview && " All fields are accepted by default; flag any items requiring resident corrections."}
                    </p>
                  </CardHeader>
                  <CardContent className="pt-5 space-y-4">
                    {categoryInfoFields.map((field) => (
                      <ReviewItem
                        key={field.id}
                        request={req}
                        field={field}
                        canReview={canReview}
                        changed={changedIds.has(field.id)}
                        previous={getPreviousFieldValue(req, field.id)}
                        onPreview={setPreview}
                        onSaveFlag={(fieldId, reason) => handleSaveFlag(fieldId, reason)}
                        onClearFlag={(f) => handleClearFlag(f)}
                        isAssessing={isAssessingField}
                      />
                    ))}
                  </CardContent>
                </Card>
              )}

              <Card className="rounded-xl border border-border/70 bg-transparent shadow-none ring-0">
                <CardHeader className="border-b border-border/70 pb-3">
                  <CardTitle className="font-heading text-lg font-medium">Documents{docCount > 0 ? ` (${docCount})` : ""}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Uploaded with this submission. Open a preview to inspect a file.
                    {canReview && " Each document is accepted by default; flag one if the resident needs to replace it."}
                  </p>
                </CardHeader>
                <CardContent className="pt-5 space-y-4">
                  {fileFields.length === 0 && (
                    <p className="py-6 text-center text-sm text-muted-foreground">This form had no document uploads.</p>
                  )}
                  {fileFields.map((field) => (
                    <ReviewItem
                      key={field.id}
                      request={req}
                      field={field}
                      canReview={canReview}
                      onPreview={setPreview}
                      onSaveFileFlag={(fileId, reason) => handleSaveFileFlag(fileId, reason)}
                      onClearFileFlag={(fileId) => handleClearFileFlag(fileId)}
                      isAssessing={isAssessingField}
                    />
                  ))}
                </CardContent>
              </Card>

              <Card className="rounded-xl border border-border/70 bg-transparent shadow-none ring-0">
                <CardContent className="flex items-start gap-3 pt-1">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">HOA Approval Confirmed</p>
                    <p className="text-xs text-muted-foreground">
                      Resident checked &ldquo;I have HOA Approval&rdquo; at submission · {formatDateTime(req.hoaConfirmedAt)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Submission History: everything about earlier rounds lives here,
                away from the current answers above, so the two never blur
                together. */}
            {earlierRounds.length > 0 && (
              <TabsContent value="submissionHistory" className="space-y-5 pt-4">
                <div className="rounded-xl border border-border/80 bg-muted/30 p-3 text-xs text-muted-foreground">
                  Round #{currentSubmissionNumber(req)} is the resident&apos;s latest submission, shown in the{" "}
                  <button type="button" onClick={() => setActiveTab("overview")} className="font-semibold text-primary hover:underline dark:text-amber-300">
                    Latest Submission
                  </button>{" "}
                  tab. Everything below is what came before it.
                </div>

                {req.revisions.length > 0 && (
                  <Card className="rounded-xl border border-border/70 bg-transparent shadow-none ring-0">
                    <CardHeader className="border-b border-border/70 pb-3">
                      <CardTitle className="font-heading text-lg font-medium">What Changed</CardTitle>
                      <p className="text-xs text-muted-foreground">Field-by-field, at a glance.</p>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-4">
                      {req.revisions.map((rev) => (
                        <div
                          key={rev.id}
                          className="grid gap-2 rounded-xl border border-border/80 p-3.5 text-sm sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center"
                        >
                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase break-words [overflow-wrap:anywhere]">
                              Previous · {rev.label}
                            </p>
                            <p className="text-muted-foreground line-through decoration-slate-400/60 break-words [overflow-wrap:anywhere] line-clamp-3">
                              {rev.previous}
                            </p>
                          </div>
                          <span className="hidden text-muted-foreground sm:block" aria-hidden="true">
                            →
                          </span>
                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                              Current · {format(new Date(rev.at), "MMM d")}
                            </p>
                            <p className="font-medium text-foreground break-words [overflow-wrap:anywhere] line-clamp-3">
                              {rev.current}
                            </p>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
                <EarlierSubmissions request={req} onPreview={setPreview} />
              </TabsContent>
            )}

            {/* Decisions & deposit */}
            <TabsContent value="decisions" className="space-y-5 pt-4">
              {(req.deposit.receipt || req.approvalLetter) && (
                <Card className="rounded-xl border border-border/70 bg-transparent shadow-none ring-0">
                  <CardHeader className="border-b border-border/70 pb-3">
                    <CardTitle className="font-heading text-lg font-medium">Staff Documents</CardTitle>
                    <p className="text-xs text-muted-foreground">Associated with deposit and final completion.</p>
                  </CardHeader>
                  <CardContent className="space-y-2.5 pt-4">
                    {req.deposit.receipt && (
                      <StaffFile
                        label="Deposit payment receipt"
                        staffOnly
                        file={req.deposit.receipt}
                        onPreview={setPreview}
                      />
                    )}
                    {req.approvalLetter && (
                      <StaffFile label="Final approval letter" file={req.approvalLetter} onPreview={setPreview} />
                    )}
                  </CardContent>
                </Card>
              )}
              <Card className="rounded-xl border border-border/70 bg-transparent shadow-none ring-0">
                <CardHeader className="border-b border-border/70 pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle className="font-heading text-lg font-medium">Review Decision</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {owner ? `Assigned reviewer: ${owner.name}.` : "No reviewer assigned yet."}
                      </p>
                    </div>
                    <StatusBadge status={req.status} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-5 pt-5">
                  {req.status === "rejected" && req.rejectionReason && (
                    <div className="rounded-xl border border-rose-300/70 bg-rose-50 p-4 dark:border-rose-900/70 dark:bg-rose-950/30">
                      <p className="flex items-center gap-2 text-sm font-semibold text-rose-950 dark:text-rose-200">
                        <XCircle className="size-4" aria-hidden="true" /> Rejection reason
                      </p>
                      <p className="mt-1.5 text-sm leading-relaxed text-rose-900/90 dark:text-rose-300/90 break-words [overflow-wrap:anywhere] whitespace-pre-wrap">
                        {req.rejectionReason}
                      </p>
                    </div>
                  )}
                  {(req.status === "changes_required" || req.status === "resubmitted") && (
                    <div className="rounded-xl border border-amber-300/70 bg-amber-50 p-4 dark:border-amber-800/70 dark:bg-amber-950/30">
                      <p className="flex items-center gap-2 text-sm font-semibold text-amber-950 dark:text-amber-200">
                        <FileEdit className="size-4" aria-hidden="true" />
                        {req.status === "resubmitted"
                          ? "Resident resubmitted corrections"
                          : `Revision requested · ${flaggedCount} flagged item${flaggedCount === 1 ? "" : "s"}`}
                      </p>
                      {req.revision?.items && req.revision.items.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {req.revision.items.map((it) => (
                            <div key={it.fieldId} className="rounded-lg bg-card/60 p-2.5 text-xs border border-border/60">
                              <span className="font-semibold text-foreground">{it.label}: </span>
                              <span className="text-muted-foreground">{it.reason}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1.5 text-sm text-amber-900/90 dark:text-amber-300/90 break-words [overflow-wrap:anywhere] whitespace-pre-wrap">
                          {req.feedback || "Please provide the requested updates to proceed."}
                        </p>
                      )}
                    </div>
                  )}
                  {["approved", "completed"].includes(req.status) && req.decidedAt && (
                    <div className="rounded-xl border border-emerald-300/70 bg-emerald-50 p-4 dark:border-emerald-900/70 dark:bg-emerald-950/30">
                      <p className="flex items-center gap-2 text-sm font-semibold text-emerald-950 dark:text-emerald-200">
                        <CheckCircle2 className="size-4" aria-hidden="true" /> Approved on {formatDate(req.decidedAt)}
                      </p>
                    </div>
                  )}
                  {req.status === "under_review" && (
                    <p className="text-sm text-muted-foreground">
                      Active review in progress. Review items in the Details tab.
                    </p>
                  )}
                  {req.status === "submitted" && (
                    <p className="text-sm text-muted-foreground">This request is newly submitted and awaiting review.</p>
                  )}
                </CardContent>
              </Card>

              <div className="grid gap-5 lg:grid-cols-2">
                <Card className="rounded-xl border border-border/70 bg-transparent shadow-none ring-0">
                  <CardHeader className="border-b border-border/70 pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="font-heading text-lg font-medium">Deposit</CardTitle>
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-amber-900 uppercase dark:bg-amber-950/40 dark:text-amber-300">
                        <Lock className="size-2.5" /> Staff only
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-5">
                    {!req.deposit.required ? (
                      <p className="text-sm text-muted-foreground">
                        {req.decidedAt
                          ? "This request does not require a deposit."
                          : "Deposit requirement is recorded after approval."}
                      </p>
                    ) : (
                      <dl className="space-y-3">
                        <InfoRow label="Amount">
                          <span className="font-mono text-lg font-bold">${req.deposit.amount?.toLocaleString()}</span>
                        </InfoRow>
                        <InfoRow label="Status">
                          <DepositChip deposit={{ ...req.deposit, amount: undefined }} />
                        </InfoRow>
                        {req.deposit.receivedAt && (
                          <InfoRow label="Received">{formatDateTime(req.deposit.receivedAt)}</InfoRow>
                        )}
                        {req.deposit.receipt && (
                          <InfoRow label="Receipt">
                            <button
                              type="button"
                              onClick={() => setPreview(req.deposit.receipt!)}
                              className="inline-flex items-center gap-1.5 text-primary hover:underline dark:text-amber-300"
                            >
                              <ReceiptText className="size-3.5" />
                              {req.deposit.receipt.name}
                            </button>
                          </InfoRow>
                        )}
                      </dl>
                    )}
                  </CardContent>
                </Card>

                <Card className="rounded-xl border border-border/70 bg-transparent shadow-none ring-0">
                  <CardHeader className="border-b border-border/70 pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="font-heading text-lg font-medium">Refund Outcome</CardTitle>
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-amber-900 uppercase dark:bg-amber-950/40 dark:text-amber-300">
                        <Lock className="size-2.5" /> Staff only
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-5">
                    {!req.refund ? (
                      <p className="text-sm text-muted-foreground">
                        {req.deposit.status === "received" && req.status !== "withdrawn"
                          ? "A refund outcome is only recorded if the request is withdrawn after a deposit is received."
                          : "No refund applies to this request."}
                      </p>
                    ) : (
                      <dl className="space-y-3">
                        <InfoRow label="Outcome">
                          <RefundChip refund={req.refund} />
                        </InfoRow>
                        {req.refund.outcome === "no_refund" && (
                          <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                            <span className="font-semibold text-foreground">&ldquo;-&rdquo; means No Refund.</span> A refund is not applicable or not agreed.
                          </p>
                        )}
                        <InfoRow label="Recorded by">{req.refund.recordedBy}</InfoRow>
                        {req.refund.proof && (
                          <InfoRow label="Proof">
                            <button
                              type="button"
                              onClick={() => setPreview(req.refund!.proof!)}
                              className="inline-flex items-center gap-1.5 text-primary hover:underline dark:text-amber-300"
                            >
                              <ReceiptText className="size-3.5" />
                              {req.refund.proof.name}
                            </button>
                          </InfoRow>
                        )}
                        <InfoRow label={req.refund.outcome === "refunded" ? "Refund date" : "Recorded on"}>
                          {formatDateTime(req.refund.date)}
                        </InfoRow>
                        <p className="text-[11px] text-muted-foreground">{REFUND_LABEL[req.refund.outcome]}</p>
                      </dl>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card className="rounded-xl border border-border/70 bg-transparent shadow-none ring-0">
                <CardHeader className="border-b border-border/70 pb-3">
                  <CardTitle className="font-heading text-lg font-medium">Approval Letter</CardTitle>
                  <p className="text-xs text-muted-foreground">Final approval letter sent to the resident.</p>
                </CardHeader>
                <CardContent className="pt-5">
                  {!req.approvalLetter ? (
                    <p className="text-sm text-muted-foreground">No final approval letter has been uploaded yet.</p>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="flex items-center gap-3 rounded-xl border border-border/80 bg-muted/30 px-3.5 py-3">
                        <FileCheck2 className="size-5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{req.approvalLetter.name}</p>
                          <p className="text-[11px] text-muted-foreground">{formatFileSize(req.approvalLetter.size)}</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setPreview(req.approvalLetter!)}>
                          <Eye />
                          View
                        </Button>
                      </div>
                      <div className="flex items-center gap-3 rounded-xl border border-emerald-300/70 bg-emerald-50 px-3.5 py-3 text-sm dark:border-emerald-900/70 dark:bg-emerald-950/30">
                        <Mail className="size-5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                        <div>
                          <p className="font-semibold">Emailed to resident</p>
                          <p className="text-[11px] text-muted-foreground">
                            {req.letterEmail ? formatDateTime(req.letterEmail.at) : "Sent on completion"}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* History */}
            <TabsContent value="history" className="pt-4">
              <Card className="rounded-xl border border-border/70 bg-transparent shadow-none ring-0">
                <CardHeader className="border-b border-border/70 pb-3">
                  <CardTitle className="font-heading text-lg font-medium">Activity Timeline</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Most recent to oldest. Every event records the action, the person, date and time, and relevant details.
                  </p>
                </CardHeader>
                <CardContent className="pt-5">
                  <HistoryTimeline events={req.history} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Sticky Bottom Review Action Bar for Active Review */}
      {canReview && (
        <div className="sticky bottom-4 z-20 mt-6 flex flex-col gap-3 rounded-2xl border border-border/80 bg-background/95 p-4 shadow-xl backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            {flaggedCount === 0 ? (
              <span className="flex size-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                <CheckCircle2 className="size-4" aria-hidden="true" />
              </span>
            ) : (
              <span className="flex size-8 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                <Flag className="size-4" aria-hidden="true" />
              </span>
            )}
            <div>
              <p className="text-sm font-semibold text-foreground">
                {flaggedCount === 0
                  ? "All fields verified · Ready for approval"
                  : `${flaggedCount} field${flaggedCount === 1 ? "" : "s"} flagged for correction`}
              </p>
              <p className="text-xs text-muted-foreground">
                {flaggedCount === 0
                  ? "Unflagged fields are accepted automatically."
                  : "Submit revision request or clear flags to approve."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/40"
              onClick={() => setRejectOpen(true)}
              disabled={isProcessingDecision}
            >
              <XCircle className="size-4 mr-1.5" />
              Reject Request
            </Button>
            {flaggedCount > 0 ? (
              <Button
                type="button"
                className="bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-600 dark:hover:bg-amber-700"
                onClick={() => setRevisionOpen(true)}
                disabled={isProcessingDecision}
              >
                {isProcessingDecision ? <Spinner className="size-4 mr-1.5" /> : <FileEdit className="size-4 mr-1.5" />}
                Request Revision ({flaggedCount})
              </Button>
            ) : (
              <Button
                type="button"
                className="bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-600 dark:hover:bg-emerald-700"
                onClick={() => setApproveOpen(true)}
                disabled={isProcessingDecision}
              >
                {isProcessingDecision ? <Spinner className="size-4 mr-1.5" /> : <CheckCircle2 className="size-4 mr-1.5" />}
                Approve Request
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Dialogs */}
      <AssignReviewerDialog request={assigning} onOpenChange={(o) => !o && setAssigning(null)} />
      <FilePreviewDialog
        file={preview}
        open={!!preview}
        onOpenChange={(o) => !o && setPreview(null)}
        onRequestDownloadUrl={(fileId, disposition) => getReviewerFileDownloadUrl(req.id, fileId, disposition).then((r) => r.url)}
      />
      <ApproveRequestDialog
        request={req}
        open={approveOpen}
        onOpenChange={setApproveOpen}
        onConfirm={handleApprove}
        isPending={isProcessingDecision}
      />
      <RequestRevisionDialog
        request={req}
        open={revisionOpen}
        onOpenChange={setRevisionOpen}
        onConfirm={handleRequestRevision}
        isPending={isProcessingDecision}
      />
      <RejectRequestDialog
        request={req}
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        onConfirm={handleReject}
        isPending={isProcessingDecision}
      />
    </div>
  );
}
