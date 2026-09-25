import axiosInstance from "@/lib/axios";
import { currentReviewer, db, delay } from "@/lib/mock/store";

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
    requestId: raw.entity?.kind === "request" ? raw.entity.id : (raw.entityId || raw.requestId || null),
    link: raw.link || undefined,
    read: Boolean(raw.read || raw.readAt),
    createdAt: raw.createdAt || new Date().toISOString(),
  };
}

/** Only the signed-in reviewer's own notifications. */
function mine(): ReviewerNotification[] {
  try {
    const me = currentReviewer();
    return db.getNotifications().filter((n) => n.reviewerId === me.id);
  } catch {
    return [];
  }
}

export async function getNotifications(): Promise<ReviewerNotification[]> {
  try {
    const { data } = await axiosInstance.get("/notifications");
    const list = data?.data?.notifications || [];
    return list.map((n: any) => toReviewerNotification(n));
  } catch {
    const list = mine();
    return delay([...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)), 60);
  }
}

export async function markNotificationRead(id: string): Promise<void> {
  try {
    await axiosInstance.patch(`/notifications/${id}/read`);
  } catch {
    db.setNotifications(db.getNotifications().map((n) => (n.id === id ? { ...n, read: true } : n)));
  }
}

export async function markAllNotificationsRead(): Promise<void> {
  try {
    await axiosInstance.post("/notifications/read-all");
  } catch {
    try {
      const me = currentReviewer();
      db.setNotifications(db.getNotifications().map((n) => (n.reviewerId === me.id ? { ...n, read: true } : n)));
    } catch {
      // ignore
    }
  }
}
