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
import { assignRequest } from "@/features/requests/api/review.service";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/features/notifications/api/notifications.service";

export const keys = {
  reviewers: ["reviewers"] as const,
  residents: ["residents"] as const,
  categories: ["categories"] as const,
  requests: ["requests"] as const,
  incomingRequests: ["requests", "incoming"] as const,
  notifications: ["notifications"] as const,
};

/* ------------------------------ queries ------------------------------ */

export const useReviewers = (params?: { search?: string; page?: number; limit?: number }) =>
  useQuery({
    queryKey: params?.search ? [...keys.reviewers, params.search] : keys.reviewers,
    queryFn: () => getReviewers(params),
  });
export const useResidents = () => useQuery({ queryKey: keys.residents, queryFn: getResidents });
export const useCategories = () => useQuery({ queryKey: keys.categories, queryFn: getCategories });
export const useRequests = (params?: ReviewerRequestsQueryParams) =>
  useQuery({ queryKey: params ? [...keys.requests, params] : keys.requests, queryFn: () => getRequests(params) });
export const useRequestsPage = (params: ReviewerRequestsQueryParams) =>
  useQuery({ queryKey: [...keys.requests, "page", params], queryFn: () => getRequestsPage(params) });
export const useRequest = (id: string) =>
  useQuery({ queryKey: [...keys.requests, id], queryFn: () => getRequestById(id), enabled: !!id });
export const useIncomingRequests = (params?: { search?: string; page?: number; limit?: number }) =>
  useQuery({
    queryKey: params ? [...keys.incomingRequests, params] : keys.incomingRequests,
    queryFn: () => getIncomingRequests(params),
  });
export const useIncomingRequestsPage = (params?: { search?: string; page?: number; limit?: number }) =>
  useQuery({
    queryKey: [...keys.incomingRequests, "page", params],
    queryFn: () => getIncomingRequestsPage(params),
  });
export const useNotifications = () => useQuery({ queryKey: keys.notifications, queryFn: getNotifications });

/* ----------------------------- mutations ----------------------------- */

function useRequestMutation<TVars>(fn: (vars: TVars) => Promise<unknown>) {
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
