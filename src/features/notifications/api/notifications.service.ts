import { currentReviewer, db, delay } from "@/lib/mock/store";

/** Only the signed-in reviewer's own notifications. */
function mine(): ReviewerNotification[] {
  const me = currentReviewer();
  return db.getNotifications().filter((n) => n.reviewerId === me.id);
}

export async function getNotifications(): Promise<ReviewerNotification[]> {
  let list: ReviewerNotification[] = [];
  try {
    list = mine();
  } catch {
    // signed out — nothing to show
  }
  return delay([...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)), 60);
}

export async function markNotificationRead(id: string): Promise<void> {
  db.setNotifications(db.getNotifications().map((n) => (n.id === id ? { ...n, read: true } : n)));
  return delay(undefined, 30);
}

export async function markAllNotificationsRead(): Promise<void> {
  const me = currentReviewer();
  db.setNotifications(db.getNotifications().map((n) => (n.reviewerId === me.id ? { ...n, read: true } : n)));
  return delay(undefined, 40);
}
