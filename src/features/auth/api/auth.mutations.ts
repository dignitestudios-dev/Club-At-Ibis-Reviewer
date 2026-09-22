import { useMutation, useQueryClient } from "@tanstack/react-query";
import { changePassword, loginUser, requestPasswordReset, resetPassword } from "./auth.service";
import { authKeys } from "./auth.queries";

export function useLoginMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (credentials: LoginCredentials) => loginUser(credentials),
    onSuccess: ({ user }) => {
      queryClient.setQueryData(authKeys.currentUser, user);
    },
  });
}

export function useForgotPasswordMutation() {
  return useMutation({
    mutationFn: (payload: ForgotPasswordPayload) => requestPasswordReset(payload),
  });
}

export function useResetPasswordMutation() {
  return useMutation({
    mutationFn: (payload: ResetPasswordPayload & { invite?: boolean }) => resetPassword(payload),
  });
}

export function useChangePasswordMutation() {
  return useMutation({
    mutationFn: (payload: ChangePasswordPayload) => changePassword(payload),
  });
}
