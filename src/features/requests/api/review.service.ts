import axiosInstance from "@/lib/axios";
import { assignReviewerRequest, toReviewerRequestRecord } from "./requests.service";

/* ------------------------------------------------------------------ */
/* Routing (default reviewers only)                                     */
/* ------------------------------------------------------------------ */

export async function assignRequest({
  requestId,
  reviewerId,
  expectedAssignmentVersion,
}: {
  requestId: string;
  reviewerId: string;
  expectedAssignmentVersion?: number;
}): Promise<RequestRecord> {
  return assignReviewerRequest({ requestId, reviewerId, expectedAssignmentVersion });
}

/* ------------------------------------------------------------------ */
/* Review Lifecycle Actions (Assigned reviewer)                       */
/* ------------------------------------------------------------------ */

export async function startReview({
  requestId,
  expectedAssignmentVersion,
  expectedWorkflowVersion,
}: {
  requestId: string;
  expectedAssignmentVersion: number;
  expectedWorkflowVersion: number;
}): Promise<RequestRecord> {
  const { data } = await axiosInstance.post(`/reviewer/requests/${requestId}/start-review`, {
    expectedAssignmentVersion,
    expectedWorkflowVersion,
  });
  const req = data?.data?.request ?? data?.request ?? data?.data;
  return toReviewerRequestRecord(req);
}

export interface ReviewItemAssessment {
  /** The review item's `key` (e.g. `field:<fieldId>` or `file:<fileId>`), or — for a field-kind item only — the bare fieldId as a backward-compatible shorthand. */
  field: string;
  decision: "accepted" | "flagged";
  reason?: string;
}

/**
 * Accept/flag one or more review items in a single atomic call. The backend
 * only exposes this bulk endpoint (PATCH .../review-items with an `items`
 * array) — there is no per-item `/review-items/:itemKey` route, confirmed by
 * a live 404 ROUTE_NOT_FOUND when something in this app regressed to calling
 * it. Every caller here must go through this one function.
 */
export async function assessReviewItems({
  requestId,
  items,
  expectedAssignmentVersion,
  expectedWorkflowVersion,
  expectedReviewVersion,
}: {
  requestId: string;
  items: ReviewItemAssessment[];
  expectedAssignmentVersion: number;
  expectedWorkflowVersion: number;
  expectedReviewVersion: number;
}): Promise<RequestRecord> {
  const { data } = await axiosInstance.patch(`/reviewer/requests/${requestId}/review-items`, {
    expectedAssignmentVersion,
    expectedWorkflowVersion,
    expectedReviewVersion,
    items: items.map((item) => ({
      field: item.field,
      decision: item.decision,
      ...(item.decision === "flagged" ? { reason: item.reason || "" } : {}),
    })),
  });
  const req = data?.data?.request ?? data?.request ?? data?.data;
  return toReviewerRequestRecord(req);
}

export async function requestRevision({
  requestId,
  expectedAssignmentVersion,
  expectedWorkflowVersion,
  expectedReviewVersion,
  feedback,
}: {
  requestId: string;
  expectedAssignmentVersion: number;
  expectedWorkflowVersion: number;
  expectedReviewVersion: number;
  feedback?: string;
}): Promise<RequestRecord> {
  const { data } = await axiosInstance.post(`/reviewer/requests/${requestId}/request-revision`, {
    expectedAssignmentVersion,
    expectedWorkflowVersion,
    expectedReviewVersion,
    ...(feedback?.trim() ? { feedback: feedback.trim() } : {}),
  });
  const req = data?.data?.request ?? data?.request ?? data?.data;
  return toReviewerRequestRecord(req);
}

export async function approveRequest({
  requestId,
  expectedAssignmentVersion,
  expectedWorkflowVersion,
  expectedReviewVersion,
}: {
  requestId: string;
  expectedAssignmentVersion: number;
  expectedWorkflowVersion: number;
  expectedReviewVersion: number;
}): Promise<RequestRecord> {
  const { data } = await axiosInstance.post(`/reviewer/requests/${requestId}/approve`, {
    expectedAssignmentVersion,
    expectedWorkflowVersion,
    expectedReviewVersion,
  });
  const req = data?.data?.request ?? data?.request ?? data?.data;
  return toReviewerRequestRecord(req);
}

export async function rejectRequest({
  requestId,
  expectedAssignmentVersion,
  expectedWorkflowVersion,
  expectedReviewVersion,
  reason,
}: {
  requestId: string;
  expectedAssignmentVersion: number;
  expectedWorkflowVersion: number;
  expectedReviewVersion: number;
  reason: string;
}): Promise<RequestRecord> {
  const { data } = await axiosInstance.post(`/reviewer/requests/${requestId}/reject`, {
    expectedAssignmentVersion,
    expectedWorkflowVersion,
    expectedReviewVersion,
    reason,
  });
  const req = data?.data?.request ?? data?.request ?? data?.data;
  return toReviewerRequestRecord(req);
}

/* ------------------------------------------------------------------ */
/* Sprint 3: Deposit Requirement                                       */
/* ------------------------------------------------------------------ */

export interface SetDepositPayload {
  requestId: string;
  expectedAssignmentVersion: number;
  expectedWorkflowVersion: number;
  depositRequired: boolean;
  amount?: string;
}

export async function setDepositRequirement({
  requestId,
  expectedAssignmentVersion,
  expectedWorkflowVersion,
  depositRequired,
  amount,
}: SetDepositPayload): Promise<RequestRecord> {
  const { data } = await axiosInstance.patch(`/reviewer/requests/${requestId}/deposit`, {
    expectedAssignmentVersion,
    expectedWorkflowVersion,
    depositRequired,
    ...(depositRequired && amount ? { amount: String(amount).trim() } : {}),
  });
  const req = data?.data?.request ?? data?.request ?? data?.data;
  return toReviewerRequestRecord(req);
}

/* ------------------------------------------------------------------ */
/* Sprint 3: Processing Files (Deposit Receipt & Final Approval Letter) */
/* ------------------------------------------------------------------ */

export type ProcessingFilePurpose = "deposit_receipt" | "final_approval_letter";

export interface CreateUploadIntentPayload {
  requestId: string;
  expectedAssignmentVersion: number;
  expectedWorkflowVersion: number;
  expectedMediaRevision: number;
  purpose: ProcessingFilePurpose;
  clientUploadId: string;
  originalName: string;
  size: number;
  declaredMimeType: string;
}

export interface UploadIntentResponse {
  file: {
    id: string;
    status: string;
    originalName: string;
    declaredMimeType: string;
    size: number;
    purpose: ProcessingFilePurpose;
  };
  upload: {
    url: string;
    method: string;
    headers: Record<string, string>;
  };
  mediaRevision: number;
}

export async function createProcessingFileUploadIntent({
  requestId,
  expectedAssignmentVersion,
  expectedWorkflowVersion,
  expectedMediaRevision,
  purpose,
  clientUploadId,
  originalName,
  size,
  declaredMimeType,
}: CreateUploadIntentPayload): Promise<UploadIntentResponse> {
  const { data } = await axiosInstance.post(`/reviewer/requests/${requestId}/processing-files/upload-intents`, {
    expectedAssignmentVersion,
    expectedWorkflowVersion,
    expectedMediaRevision,
    purpose,
    clientUploadId,
    originalName,
    size,
    declaredMimeType,
  });
  return data.data;
}

export interface CompleteUploadPayload {
  requestId: string;
  fileId: string;
  expectedAssignmentVersion: number;
  expectedWorkflowVersion: number;
  expectedMediaRevision: number;
}

export interface CompleteUploadResponse {
  file: {
    id: string;
    name: string;
    size: number;
    mimeType: string;
    status: string;
    uploadedAt: string;
  };
  workflowVersion: number;
  mediaRevision: number;
}

export async function completeProcessingFileUpload({
  requestId,
  fileId,
  expectedAssignmentVersion,
  expectedWorkflowVersion,
  expectedMediaRevision,
}: CompleteUploadPayload): Promise<CompleteUploadResponse> {
  const { data } = await axiosInstance.post(`/reviewer/requests/${requestId}/processing-files/${fileId}/complete`, {
    expectedAssignmentVersion,
    expectedWorkflowVersion,
    expectedMediaRevision,
  });
  return data.data;
}

/* ------------------------------------------------------------------ */
/* Sprint 3: Request Completion                                       */
/* ------------------------------------------------------------------ */

export interface CompleteRequestPayload {
  requestId: string;
  expectedAssignmentVersion: number;
  expectedWorkflowVersion: number;
  idempotencyKey?: string;
}

export async function completeRequest({
  requestId,
  expectedAssignmentVersion,
  expectedWorkflowVersion,
  idempotencyKey,
}: CompleteRequestPayload): Promise<RequestRecord> {
  const key = idempotencyKey || `complete-${requestId}-${Date.now()}`;
  const { data } = await axiosInstance.post(
    `/reviewer/requests/${requestId}/complete`,
    {
      expectedAssignmentVersion,
      expectedWorkflowVersion,
    },
    {
      headers: {
        "Idempotency-Key": key,
      },
    }
  );
  const req = data?.data?.request ?? data?.request ?? data?.data;
  return toReviewerRequestRecord(req);
}

/* ------------------------------------------------------------------ */
/* Sprint 3: Completion Email Retry                                   */
/* ------------------------------------------------------------------ */

export interface RetryCompletionEmailPayload {
  requestId: string;
  expectedAssignmentVersion: number;
  expectedWorkflowVersion: number;
}

export async function retryCompletionEmail({
  requestId,
  expectedAssignmentVersion,
  expectedWorkflowVersion,
}: RetryCompletionEmailPayload): Promise<RequestRecord> {
  const { data } = await axiosInstance.post(`/reviewer/requests/${requestId}/completion-email/retry`, {
    expectedAssignmentVersion,
    expectedWorkflowVersion,
  });
  const req = data?.data?.request ?? data?.request ?? data?.data;
  return toReviewerRequestRecord(req);
}

/* ------------------------------------------------------------------ */
/* Sprint 3: Withdrawal                                               */
/* ------------------------------------------------------------------ */

export interface WithdrawRequestReviewerPayload {
  requestId: string;
  residentContactAcknowledged: boolean;
  expectedAssignmentVersion: number;
  expectedWorkflowVersion: number;
}

export async function withdrawRequestAsReviewer({
  requestId,
  residentContactAcknowledged,
  expectedAssignmentVersion,
  expectedWorkflowVersion,
}: WithdrawRequestReviewerPayload): Promise<RequestRecord> {
  const { data } = await axiosInstance.post(`/reviewer/requests/${requestId}/withdraw`, {
    residentContactAcknowledged,
    expectedAssignmentVersion,
    expectedWorkflowVersion,
  });
  const req = data?.data?.request ?? data?.request ?? data?.data;
  return toReviewerRequestRecord(req);
}

/* ------------------------------------------------------------------ */
/* Sprint 3: Refund Outcomes                                          */
/* ------------------------------------------------------------------ */

export interface SetRefundOutcomePayload {
  requestId: string;
  expectedAssignmentVersion: number;
  expectedWorkflowVersion: number;
  outcome: "refunded" | "no_refund";
  refundDate?: string; // Required when outcome === "refunded" (YYYY-MM-DD)
  correctionReason?: string; // Optional for corrections
}

export async function setRefundOutcome({
  requestId,
  expectedAssignmentVersion,
  expectedWorkflowVersion,
  outcome,
  refundDate,
  correctionReason,
}: SetRefundOutcomePayload): Promise<RequestRecord> {
  const { data } = await axiosInstance.patch(`/reviewer/requests/${requestId}/refund-outcome`, {
    expectedAssignmentVersion,
    expectedWorkflowVersion,
    outcome,
    ...(outcome === "refunded" && refundDate ? { refundDate } : {}),
    ...(correctionReason?.trim() ? { correctionReason: correctionReason.trim() } : {}),
  });
  const req = data?.data?.request ?? data?.request ?? data?.data;
  return toReviewerRequestRecord(req);
}
