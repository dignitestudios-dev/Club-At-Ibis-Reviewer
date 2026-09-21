"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getCategories, getRequests, getResidents, getReviewers } from "@/features/requests/api/requests.service";
import {
  acceptItems,
  approveRequest,
  assignRequest,
  completeRequest,
  markRefunded,
  recordReceipt,
  recordRefundOutcome,
  rejectRequest,
  requestRevision,
  resendApprovalEmail,
  reviewItem,
  setDeposit,
  startReview,
  uploadLetter,
} from "@/features/requests/api/review.service";
import { getNotifications, markAllNotificationsRead, markNotificationRead } from "@/features/notifications/api/notifications.service";

export const keys = {
  reviewers: ["reviewers"] as const,
  residents: ["residents"] as const,
  categories: ["categories"] as const,
  requests: ["requests"] as const,
  notifications: ["notifications"] as const,
};

/* ------------------------------ queries ------------------------------ */

export const useReviewers = () => useQuery({ queryKey: keys.reviewers, queryFn: getReviewers });
export const useResidents = () => useQuery({ queryKey: keys.residents, queryFn: getResidents });
export const useCategories = () => useQuery({ queryKey: keys.categories, queryFn: getCategories });
export const useRequests = () => useQuery({ queryKey: keys.requests, queryFn: getRequests });
export const useNotifications = () => useQuery({ queryKey: keys.notifications, queryFn: getNotifications });

/* ----------------------------- mutations ----------------------------- */

/** Every review action changes the request and may notify other reviewers. */
function useRequestMutation<TVars>(fn: (vars: TVars) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => Promise.all([keys.requests, keys.notifications].map((queryKey) => qc.invalidateQueries({ queryKey }))),
  });
}

export const useStartReview = () => useRequestMutation(startReview);
export const useReviewItem = () => useRequestMutation(reviewItem);
export const useAcceptItems = () => useRequestMutation(acceptItems);
export const useRequestRevision = () => useRequestMutation(requestRevision);
export const useRejectRequest = () => useRequestMutation(rejectRequest);
export const useApproveRequest = () => useRequestMutation(approveRequest);
export const useSetDeposit = () => useRequestMutation(setDeposit);
export const useRecordReceipt = () => useRequestMutation(recordReceipt);
export const useUploadLetter = () => useRequestMutation(uploadLetter);
export const useCompleteRequest = () => useRequestMutation(completeRequest);
export const useResendApprovalEmail = () => useRequestMutation(resendApprovalEmail);
export const useRecordRefundOutcome = () => useRequestMutation(recordRefundOutcome);
export const useMarkRefunded = () => useRequestMutation(markRefunded);
export const useAssignRequest = () => useRequestMutation(assignRequest);

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.notifications }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.notifications }),
  });
}
