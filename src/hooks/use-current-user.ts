"use client";

import { useCurrentUserQuery } from "@/features/auth/api/auth.queries";
import { useReviewers } from "@/hooks/use-reviewer-data";
import { useAppSelector } from "@/store";
import { isDefaultReviewer } from "@/lib/domain";

/** The session user as saved at sign-in. Prefer `useMe` for live account data. */
export function useCurrentUser(): PublicReviewer | null {
  const { data } = useCurrentUserQuery();
  const reduxUser = useAppSelector((state) => state.auth.user);
  return reduxUser ?? (data ?? null);
}

/**
 * The signed-in reviewer with live account data (the Super Admin can change
 * Default-Reviewer status at any time, which changes what this reviewer sees).
 */
export function useMe() {
  const session = useCurrentUser();
  const { data: reviewers } = useReviewers();
  const me = reviewers?.find((r) => r.id === session?.id) ?? session;
  return { me, isDefault: isDefaultReviewer(me) };
}
