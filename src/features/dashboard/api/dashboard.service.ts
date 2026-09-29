import axiosInstance from "@/lib/axios";

export interface DashboardRequestCard {
  id: string;
  reference: string;
  title: string;
  status: RequestStatus;
  depositStatus: string;
  refundOutcome: string | null;
  categoryId: string;
  categoryName: string;
  residentId: string;
  residentName: string;
  propertyAddress: string | null;
  lotNo: string | null;
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
}

function toRequestCard(r: any): DashboardRequestCard {
  return {
    id: r.id,
    reference: r.reference,
    title: r.title,
    status: r.status,
    depositStatus: r.depositStatus,
    refundOutcome: r.refundOutcome ?? null,
    categoryId: r.category?.id,
    categoryName: r.category?.name ?? "",
    residentId: r.resident?.id ?? "",
    residentName: r.resident?.displayName || `${r.resident?.firstName ?? ""} ${r.resident?.lastName ?? ""}`.trim(),
    propertyAddress: r.property?.address ?? null,
    lotNo: r.property?.lotNo ?? null,
    submittedAt: r.submittedAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function toNotification(n: any): ReviewerNotification {
  return {
    id: n.id,
    reviewerId: "",
    type: (n.type ?? "request_update") as ReviewerNotificationType,
    title: n.title,
    message: n.message,
    // The backend's own `link` field (e.g. "/incoming-requests/:id",
    // "/assigned-requests/:id") points at routes this app doesn't have — its
    // only real request-detail route is /requests/:id. Deriving the link
    // from `entity` instead of trusting `link` gets a route that actually
    // exists, for every current notification type (see REQUEST_NOTIFICATION_TYPES
    // in the backend's request.constants.js: incoming_request, request_assigned,
    // request_reassigned and request_ownership_removed are the only ones
    // currently ever created, and all of them are about a single request).
    requestId: n.entity?.kind === "request" ? n.entity.id : null,
    read: !!n.read,
    createdAt: n.createdAt,
  };
}

export interface ReviewerDashboardResult {
  capabilities: { sharedIntake: boolean };
  attention: {
    total: number;
    incoming: number;
    readyToStart: number;
    resubmitted: number;
    approvedForCompletion: number;
    refundActions: number;
  };
  workload: {
    totalAssigned: number;
    openRequests: number;
    underReview: number;
    waitingOnResidents: number;
    completed: number;
  };
  statusCounts: Partial<Record<RequestStatus, number>>;
  upNext: DashboardRequestCard[];
  notifications: { unreadCount: number; recent: ReviewerNotification[] };
}

/** GET /reviewer/dashboard — the single source for every Reviewer dashboard number; no separate fetch-all requests/residents/notifications calls. */
export async function getReviewerDashboard(): Promise<ReviewerDashboardResult> {
  const { data } = await axiosInstance.get("/reviewer/dashboard");
  const d = data.data;
  return {
    capabilities: { sharedIntake: !!d.capabilities?.sharedIntake },
    attention: {
      total: d.attention?.total ?? 0,
      incoming: d.attention?.incoming ?? 0,
      readyToStart: d.attention?.readyToStart ?? 0,
      resubmitted: d.attention?.resubmitted ?? 0,
      approvedForCompletion: d.attention?.approvedForCompletion ?? 0,
      refundActions: d.attention?.refundActions ?? 0,
    },
    workload: {
      totalAssigned: d.workload?.totalAssigned ?? 0,
      openRequests: d.workload?.openRequests ?? 0,
      underReview: d.workload?.underReview ?? 0,
      waitingOnResidents: d.workload?.waitingOnResidents ?? 0,
      completed: d.workload?.completed ?? 0,
    },
    statusCounts: d.statusCounts ?? {},
    upNext: (d.upNext ?? []).map(toRequestCard),
    notifications: {
      unreadCount: d.notifications?.unreadCount ?? 0,
      recent: (d.notifications?.recent ?? []).map(toNotification),
    },
  };
}
