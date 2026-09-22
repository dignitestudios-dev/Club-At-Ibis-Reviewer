"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useAppDispatch } from "@/store";
import { clearUser } from "@/store/slices/auth.slice";
import { authKeys } from "@/features/auth/api/auth.queries";
import { logoutUser } from "@/features/auth/api/auth.service";

export function useLogout() {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();

  return async function logout() {
    try {
      await logoutUser();
    } catch {
      // Best-effort
    } finally {
      localStorage.setItem("carv.logged-out", "true");
      localStorage.removeItem("rv-auth-token");
      localStorage.removeItem("rv-auth-user");
      document.cookie = "rv-auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0";
      dispatch(clearUser());
      queryClient.setQueryData(authKeys.currentUser, null);
      queryClient.removeQueries();
      window.location.href = "/auth/login";
    }
  };
}
