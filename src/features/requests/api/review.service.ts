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

export async function assessReviewItem({
  requestId,
  itemKey,
  decision,
  reason,
  expectedAssignmentVersion,
  expectedWorkflowVersion,
  expectedReviewVersion,
}: {
  requestId: string;
  itemKey: string;
  decision: "accepted" | "flagged";
  reason?: string;
  expectedAssignmentVersion: number;
  expectedWorkflowVersion: number;
  expectedReviewVersion: number;
}): Promise<RequestRecord> {
  const { data } = await axiosInstance.patch(
    `/reviewer/requests/${requestId}/review-items/${encodeURIComponent(itemKey)}`,
    {
      expectedAssignmentVersion,
      expectedWorkflowVersion,
      expectedReviewVersion,
      decision,
      ...(decision === "flagged" ? { reason: reason || "" } : {}),
    }
  );
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
