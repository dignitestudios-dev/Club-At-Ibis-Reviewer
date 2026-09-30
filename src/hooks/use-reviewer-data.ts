"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getCategories,
  getIncomingRequests,
  getIncomingRequestsPage,
  getRequestById,
  getRequests,
  getRequestsPage,
  getResidents,
  getReviewers,
  type ReviewerRequestsQueryParams,
} from "@/features/requests/api/requests.service";
import {
  approveRequest,
  assessReviewItem,
  assignRequest,
  rejectRequest,
  requestRevision,
  startReview,
} from "@/features/requests/api/review.service";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/features/notifications/api/notifications.service";
import { getCategoryVersions } from "@/features/forms/api/forms.service";

export const keys = {
  reviewers: ["reviewers"] as const,
  residents: ["residents"] as const,
  categories: ["categories"] as const,
  requests: ["requests"] as const,
  incomingRequests: ["requests", "incoming"] as const,
  notifications: ["notifications"] as const,
};

/* ------------------------------ queries ------------------------------ */

export const useReviewers = (
  params?: { search?: string; page?: number; limit?: number },
  options?: { enabled?: boolean }
) =>
  useQuery({
    queryKey: params?.search ? [...keys.reviewers, params.search] : keys.reviewers,
    queryFn: () => getReviewers(params),
    enabled: options?.enabled ?? true,
    staleTime: 60 * 1000,
  });
export const useResidents = (options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: keys.residents,
    queryFn: getResidents,
    enabled: options?.enabled ?? true,
    staleTime: 60 * 1000,
  });
export const useCategories = (options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: keys.categories,
    queryFn: getCategories,
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000,
  });
/** The real version history for one category, same endpoint family the admin side's version viewer uses. */
export const useCategoryVersions = (categoryId: string, options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: [...keys.categories, categoryId, "versions"],
    queryFn: () => getCategoryVersions(categoryId),
    enabled: (options?.enabled ?? true) && !!categoryId,
    staleTime: 60 * 1000,
  });
export const useRequests = (params?: ReviewerRequestsQueryParams, options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: params ? [...keys.requests, params] : keys.requests,
    queryFn: () => getRequests(params),
    enabled: options?.enabled ?? true,
    staleTime: 15 * 1000,
  });
export const useRequestsPage = (params: ReviewerRequestsQueryParams, options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: [...keys.requests, "page", params],
    queryFn: () => getRequestsPage(params),
    enabled: options?.enabled ?? true,
    staleTime: 15 * 1000,
  });
export const useRequest = (id: string, options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: [...keys.requests, id],
    queryFn: () => getRequestById(id),
    enabled: (options?.enabled ?? true) && !!id,
    staleTime: 15 * 1000,
  });
export const useIncomingRequests = (
  params?: { search?: string; page?: number; limit?: number },
  options?: { enabled?: boolean }
) =>
  useQuery({
    queryKey: params ? [...keys.incomingRequests, params] : keys.incomingRequests,
    queryFn: () => getIncomingRequests(params),
    enabled: options?.enabled ?? true,
    staleTime: 15 * 1000,
  });
export const useIncomingRequestsPage = (
  params?: { search?: string; page?: number; limit?: number },
  options?: { enabled?: boolean }
) =>
  useQuery({
    queryKey: [...keys.incomingRequests, "page", params],
    queryFn: () => getIncomingRequestsPage(params),
    enabled: options?.enabled ?? true,
    staleTime: 15 * 1000,
  });
export const useNotifications = (options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: keys.notifications,
    queryFn: getNotifications,
    enabled: options?.enabled ?? true,
    staleTime: 15 * 1000,
  });

/* ----------------------------- mutations ----------------------------- */

function useRequestMutation<TVars, TResult = unknown>(fn: (vars: TVars) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: keys.requests }),
        qc.invalidateQueries({ queryKey: keys.incomingRequests }),
        qc.invalidateQueries({ queryKey: keys.notifications }),
      ]),
  });
}

export const useAssignRequest = () => useRequestMutation(assignRequest);
export const useStartReview = () => useRequestMutation(startReview);
export const useAssessReviewItem = () => useRequestMutation(assessReviewItem);
export const useRequestRevision = () => useRequestMutation(requestRevision);
export const useApproveRequest = () => useRequestMutation(approveRequest);
export const useRejectRequest = () => useRequestMutation(rejectRequest);

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
