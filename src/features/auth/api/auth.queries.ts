import { useQuery } from "@tanstack/react-query";
import { getCurrentUser, inspectInvitation } from "./auth.service";

export const authKeys = {
  all: ["auth"] as const,
  currentUser: ["auth", "currentUser"] as const,
  invitation: (token: string) => ["auth", "invitation", token] as const,
};

export function useCurrentUserQuery() {
  return useQuery({
    queryKey: authKeys.currentUser,
    queryFn: getCurrentUser,
    staleTime: 60 * 1000,
  });
}

export function useInspectInvitationQuery(token: string) {
  return useQuery({
    queryKey: authKeys.invitation(token),
    queryFn: () => inspectInvitation(token),
    enabled: Boolean(token),
    retry: false,
    staleTime: 0,
  });
}
