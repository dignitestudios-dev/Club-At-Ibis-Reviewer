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
 * Accept/flag one or more review items in a single atomic call. Replaces the
 * old per-item `PATCH /review-items/:fieldId` endpoint, which no longer
 * exists — the backend now generates one review item per uploaded file (not
 * just one per field), so a batch call is required to assess several items
 * without racing `expectedReviewVersion` against yourself.
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
}: {
  requestId: string;
  expectedAssignmentVersion: number;
  expectedWorkflowVersion: number;
  expectedReviewVersion: number;
}): Promise<RequestRecord> {
  const { data } = await axiosInstance.post(`/reviewer/requests/${requestId}/request-revision`, {
    expectedAssignmentVersion,
    expectedWorkflowVersion,
    expectedReviewVersion,
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
