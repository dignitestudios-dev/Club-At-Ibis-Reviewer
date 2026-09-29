import axiosInstance from "@/lib/axios";

function toReviewerNotification(raw: any, reviewerId?: string): ReviewerNotification {
  const rawType = String(raw.type || "").trim();
  let type: ReviewerNotificationType = "action_required";
  if (rawType === "request_assigned" || rawType === "new_assignment" || rawType === "assigned" || rawType === "reassigned") {
    type = "new_assignment";
  } else if (rawType === "incoming_request" || rawType === "request_submitted" || rawType === "new_submission" || rawType === "submitted") {
    type = "incoming_request";
  } else if (rawType === "form_updated") {
    type = "form_updated";
  } else if (rawType === "resubmission" || rawType === "resubmitted") {
    type = "resubmission";
  } else if (rawType === "request_update" || rawType === "updated") {
    type = "request_update";
  } else if (rawType === "withdrawal" || rawType === "withdrawn") {
    type = "withdrawal";
  } else if (rawType === "action_required") {
    type = "action_required";
  }

  return {
    id: raw.id || raw._id,
    reviewerId: reviewerId || raw.reviewerId || "",
    type,
    title: raw.title ?? "",
    message: raw.message ?? "",
    // Deliberately ignoring the backend's own `link` field: every notification
    // type it currently sends (incoming_request, request_assigned,
    // request_reassigned, request_ownership_removed — see
    // REQUEST_NOTIFICATION_TYPES in the backend's request.constants.js) sets
    // `link` to a path this app doesn't have (e.g. "/incoming-requests/:id",
    // "/assigned-requests/:id"). The real, working route is /requests/:id,
    // which is what `requestId` below resolves to.
    requestId: raw.entity?.kind === "request" ? raw.entity.id : (raw.entityId || raw.requestId || null),
    read: Boolean(raw.read || raw.readAt),
    createdAt: raw.createdAt || new Date().toISOString(),
  };
}

export async function getNotifications(): Promise<ReviewerNotification[]> {
  try {
    const { data } = await axiosInstance.get("/notifications");
    const list = data?.data?.notifications || [];
    return list.map((n: any) => toReviewerNotification(n));
  } catch {
    return [];
  }
}

export async function markNotificationRead(id: string): Promise<void> {
  await axiosInstance.patch(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await axiosInstance.post("/notifications/read-all");
}
