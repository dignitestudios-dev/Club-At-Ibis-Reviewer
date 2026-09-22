"use client";

import { useCurrentUserQuery } from "@/features/auth/api/auth.queries";
import { useAppSelector } from "@/store";
import { isDefaultReviewer } from "@/lib/domain";

/** The session user as saved at sign-in. Prefer `useMe` for live account data. */
export function useCurrentUser(): PublicReviewer | null {
  const { data } = useCurrentUserQuery();
  const reduxUser = useAppSelector((state) => state.auth.user);
  return reduxUser ?? (data ?? null);
}

/**
 * The signed-in reviewer with live account data — `/auth/me` is fetched
 * fresh (subject to the query's staleTime) each time, so this reflects
 * Default-Reviewer changes the Super Admin makes without needing a
 * separate cross-reference against the (unrelated, mock) reviewers list.
 */
export function useMe() {
  const me = useCurrentUser();
  return { me, isDefault: isDefaultReviewer(me) };
}
