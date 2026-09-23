"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { RequiredMark } from "@/components/shared/required-mark";
import { PasswordInput } from "@/components/shared/password-input";
import { Spinner } from "@/components/ui/spinner";
import { Field, FieldContent, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { changePasswordSchema } from "@/features/auth/schemas/auth.schema";
import { useChangePasswordMutation } from "@/features/auth/api/auth.mutations";
import { useLogout } from "@/hooks/use-logout";
import { useToast } from "@/hooks/use-toast";

export default function ChangePasswordForm() {
  const toast = useToast();
  const logout = useLogout();
  const { mutate, isPending } = useChangePasswordMutation();
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordPayload>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmNewPassword: "" },
  });

  function onSubmit(data: ChangePasswordPayload) {
    mutate(data, {
      onSuccess: () => {
        // Changing the password revokes the token used to make this
        // request — the account is signed out server-side either way, so
        // the client session has to follow, not just show a toast.
        toast.success("Password changed", "Sign in again with your new password.");
        logout();
      },
      onError: (e: Error) => toast.error("Could not change password", e.message),
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate autoComplete="off" onReset={() => reset()}>
      <FieldGroup>
        <Controller
          name="currentPassword"
          control={control}
          render={({ field }) => (
            <Field data-invalid={!!errors.currentPassword}>
              <FieldLabel htmlFor="currentPassword">Current password<RequiredMark /></FieldLabel>
              <FieldContent>
                <PasswordInput id="currentPassword" autoComplete="current-password" maxLength={128} disabled={isPending} value={field.value} onChange={field.onChange} onBlur={field.onBlur} ref={field.ref} />
                <FieldError errors={errors.currentPassword ? [errors.currentPassword] : []} />
              </FieldContent>
            </Field>
          )}
        />
        <Controller
          name="newPassword"
          control={control}
          render={({ field }) => (
            <Field data-invalid={!!errors.newPassword}>
              <FieldLabel htmlFor="newPassword">New password<RequiredMark /></FieldLabel>
              <FieldContent>
                <PasswordInput id="newPassword" autoComplete="new-password" showStrength maxLength={128} disabled={isPending} value={field.value} onChange={field.onChange} onBlur={field.onBlur} ref={field.ref} />
                <FieldError errors={errors.newPassword ? [errors.newPassword] : []} />
              </FieldContent>
            </Field>
          )}
        />
        <Controller
          name="confirmNewPassword"
          control={control}
          render={({ field }) => (
            <Field data-invalid={!!errors.confirmNewPassword}>
              <FieldLabel htmlFor="confirmNewPassword">Confirm new password<RequiredMark /></FieldLabel>
              <FieldContent>
                <PasswordInput id="confirmNewPassword" autoComplete="new-password" maxLength={128} disabled={isPending} value={field.value} onChange={field.onChange} onBlur={field.onBlur} ref={field.ref} />
                <FieldError errors={errors.confirmNewPassword ? [errors.confirmNewPassword] : []} />
              </FieldContent>
            </Field>
          )}
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending && <Spinner className="size-4" />}
            Change password
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
