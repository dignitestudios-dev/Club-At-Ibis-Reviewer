"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { announceRequestConflict } from "@/hooks/use-close-on-conflict";
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
  assessReviewItems,
  assignRequest,
  completeRequest,
  rejectRequest,
  requestRevision,
  retryCompletionEmail,
  setDepositRequirement,
  setRefundOutcome,
  startReview,
  withdrawRequestAsReviewer,
} from "@/features/requests/api/review.service";
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/features/notifications/api/notifications.service";
import { getCategoryVersions } from "@/features/forms/api/forms.service";

export const keys = {
  reviewers: ["reviewers"] as const,
  residents: ["residents"] as const,
  categories: ["categories"] as const,
  /** Root of everything request-related. Prefer the narrower keys below when invalidating. */
  requests: ["requests"] as const,
  /** Every list / count query (not single requests, not the incoming queue). */
  requestLists: ["requests", "list"] as const,
  requestDetail: (id: string) => ["requests", "detail", id] as const,
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
    queryKey: [...keys.requestLists, params ?? "all"],
    queryFn: () => getRequests(params),
    enabled: options?.enabled ?? true,
    staleTime: 15 * 1000,
  });
export const useRequestsPage = (params: ReviewerRequestsQueryParams, options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: [...keys.requestLists, "page", params],
    queryFn: () => getRequestsPage(params),
    enabled: options?.enabled ?? true,
    staleTime: 15 * 1000,
  });
export const useRequest = (id: string, options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: keys.requestDetail(id),
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
export const useUnreadNotificationCount = (options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: [...keys.notifications, "unread-count"] as const,
    queryFn: getUnreadNotificationCount,
    enabled: options?.enabled ?? true,
    staleTime: 15 * 1000,
    refetchInterval: 60 * 1000,
  });
export const useNotifications = (options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: keys.notifications,
    queryFn: getNotifications,
    enabled: options?.enabled ?? true,
    staleTime: 15 * 1000,
  });

/* ----------------------------- mutations ----------------------------- */

/**
 * How much of the cached list data a mutation makes out of date:
 *  - "refetch": a request moved between buckets (status / assignee / refund), so the counts and open lists reload now;
 *  - "stale": only details shown on rows changed — mark lists stale, they reload the next time they are shown;
 *  - "none": nothing visible in any list changed.
 */
type ListImpact = "refetch" | "stale" | "none";

/** HTTP 409: the request moved on (another tab / session / reviewer) since this screen loaded it. */
export function isConflictError(err: unknown): boolean {
  // `lib/axios.ts` rejects with a plain Error carrying `statusCode`; keep `response.status` as a fallback.
  const e = err as { statusCode?: number; response?: { status?: number } } | null;
  return (e?.statusCode ?? e?.response?.status) === 409;
}

/**
 * Every request mutation returns the updated request, so the detail cache is written straight from the
 * response (no extra GET). Lists are only touched as far as the mutation actually affects them, and the
 * reviewer's own actions don't create notifications for them, so those are left alone.
 */
function useRequestMutation<TVars extends { requestId: string }>(
  fn: (vars: TVars) => Promise<RequestRecord>,
  { lists, incoming = false }: { lists: ListImpact; incoming?: boolean }
) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: fn,
    // A stale-version 409 means the request changed elsewhere. Reload it (and the lists) right away so the
    // screen shows the real state, and tell the reviewer once — callers don't need their own 409 handling.
    onError: (error, vars) => {
      if (!isConflictError(error)) return;
      announceRequestConflict();
      void qc.invalidateQueries({ queryKey: keys.requestDetail(vars.requestId) });
      void qc.invalidateQueries({ queryKey: keys.requestLists, refetchType: "active" });
      toast.warning(
        "Request updated",
        "This request was changed elsewhere (for example in another tab), so it has been refreshed. Review the latest details and try again."
      );
    },
    onSuccess: (updated, vars) => {
      qc.setQueryData(keys.requestDetail(vars.requestId), updated);
      const tasks: Promise<unknown>[] = [];
      if (lists !== "none") {
        tasks.push(qc.invalidateQueries({ queryKey: keys.requestLists, refetchType: lists === "refetch" ? "active" : "none" }));
      }
      if (incoming) tasks.push(qc.invalidateQueries({ queryKey: keys.incomingRequests }));
      return Promise.all(tasks);
    },
  });
}

/** For flows that don't go through a request mutation (file uploads): reload one request and the affected lists. */
export function useRefreshRequest() {
  const qc = useQueryClient();
  return (requestId: string, lists: ListImpact = "stale") =>
    Promise.all([
      qc.invalidateQueries({ queryKey: keys.requestDetail(requestId) }),
      lists === "none"
        ? undefined
        : qc.invalidateQueries({ queryKey: keys.requestLists, refetchType: lists === "refetch" ? "active" : "none" }),
    ]);
}

export const useAssignRequest = () => useRequestMutation(assignRequest, { lists: "refetch", incoming: true });
export const useStartReview = () => useRequestMutation(startReview, { lists: "refetch" });
// Flagging / accepting a single item changes nothing any list shows.
export const useAssessReviewItems = () => useRequestMutation(assessReviewItems, { lists: "none" });
export const useRequestRevision = () => useRequestMutation(requestRevision, { lists: "refetch" });
export const useApproveRequest = () => useRequestMutation(approveRequest, { lists: "refetch" });
export const useRejectRequest = () => useRequestMutation(rejectRequest, { lists: "refetch" });

/* Sprint 3 Reviewer Mutations */
export const useSetDepositRequirement = () => useRequestMutation(setDepositRequirement, { lists: "stale" });
export const useCompleteRequest = () => useRequestMutation(completeRequest, { lists: "refetch" });
export const useRetryCompletionEmail = () => useRequestMutation(retryCompletionEmail, { lists: "none" });
export const useWithdrawRequest = () => useRequestMutation(withdrawRequestAsReviewer, { lists: "refetch" });
export const useSetRefundOutcome = () => useRequestMutation(setRefundOutcome, { lists: "refetch" });

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
