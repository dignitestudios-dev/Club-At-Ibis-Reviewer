"use client";

import { useMe } from "@/hooks/use-current-user";
import { useIncomingRequestsPage, useRequestsPage, useUnreadNotificationCount } from "@/hooks/use-reviewer-data";

/**
 * The live counters shown as badges in the sidebar, the phone tab bar and the phone menu.
 * Same queries (and cache keys) as the desktop sidebar, so every surface always agrees.
 */
export function useNavCounts() {
  const { me, isDefault } = useMe();
  // "Assigned Requests" = My Assigned Requests > Active tab total. `limit: 1` keeps it cheap; `pagination.total` is the real count.
  const { data: actionPage } = useRequestsPage(
    { status: "submitted,assigned,under_review,changes_required,resubmitted,approved", assignedReviewerId: isDefault ? me?.id : undefined, limit: 1 },
    { enabled: !!me }
  );
  // The shared intake queue is Default Reviewer only: anyone else would get a 403.
  const { data: incomingPage } = useIncomingRequestsPage({ limit: 1 }, { enabled: isDefault });
  const { data: unreadNotifications } = useUnreadNotificationCount();
  return {
    mine: actionPage?.pagination?.total ?? 0,
    incoming: incomingPage?.pagination?.total ?? 0,
    notifications: unreadNotifications ?? 0,
  };
}
