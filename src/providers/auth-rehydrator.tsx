"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAppDispatch } from "@/store";
import { setUser, clearUser } from "@/store/slices/auth.slice";
import { authKeys } from "@/features/auth/api/auth.queries";
import { getCurrentUser } from "@/features/auth/api/auth.service";

function isValidReviewer(value: unknown): value is PublicReviewer {
  if (!value || typeof value !== "object") return false;
  const r = value as Partial<PublicReviewer>;
  return (
    typeof r.id === "string" &&
    typeof r.email === "string" &&
    typeof r.name === "string"
  );
}

/**
 * Restores the reviewer session on load. The cached copy in localStorage is
 * trusted immediately (so a protected page doesn't flash empty while a
 * request is in flight), then confirmed against the backend in the
 * background.
 *
 * A token that's expired, revoked, or belongs to a now-deactivated account
 * gets a 401 from /auth/me — the axios response interceptor (lib/axios.ts)
 * handles that globally: clears the session and redirects to login. Any
 * other failure here is left alone — the optimistic session above stays in
 * place rather than logging the reviewer out for something that wasn't
 * actually an auth problem.
 */
export default function AuthRehydrator({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();

  useEffect(() => {
    const loggedOut = localStorage.getItem("carv.logged-out") === "true";
    const token = localStorage.getItem("rv-auth-token");
    const stored = localStorage.getItem("rv-auth-user");

    if (loggedOut || !token) {
      dispatch(clearUser());
      queryClient.setQueryData(authKeys.currentUser, null);
      return;
    }

    if (stored) {
      try {
        const parsed: unknown = JSON.parse(stored);
        if (isValidReviewer(parsed)) {
          dispatch(setUser(parsed));
          queryClient.setQueryData(authKeys.currentUser, parsed);
        }
      } catch {
        // fall through — the validation call below corrects this either way
      }
    }

    // `fetchQuery` (not the raw service call) so this shares one request
    // with any other mounted `useCurrentUserQuery()` instead of both firing
    // their own /auth/me — and so it dedupes with itself under React
    // Strict Mode's double-effect in dev.
    queryClient
      .fetchQuery({ queryKey: authKeys.currentUser, queryFn: getCurrentUser, staleTime: 60_000 })
      .then((user) => {
        if (user) {
          localStorage.setItem("rv-auth-user", JSON.stringify(user));
          dispatch(setUser(user));
        }
      })
      .catch(() => {
        // A real 401 is already handled globally by the axios interceptor;
        // anything else just leaves the optimistic session above in place.
      });
  }, [dispatch, queryClient]);

  return <>{children}</>;
}
