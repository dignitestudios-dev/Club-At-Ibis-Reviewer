"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Clock, MailCheck, RotateCw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RequiredMark } from "@/components/shared/required-mark";
import { PasswordInput } from "@/components/shared/password-input";
import { Spinner } from "@/components/ui/spinner";
import { Field, FieldContent, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { resetPasswordSchema, forgotPasswordSchema } from "@/features/auth/schemas/auth.schema";
import { useResetPasswordMutation, useForgotPasswordMutation } from "@/features/auth/api/auth.mutations";
import { useInspectInvitationQuery } from "@/features/auth/api/auth.queries";
import { useToast } from "@/hooks/use-toast";

export default function ResetPasswordForm({ token, mode = "reset" }: { token: string; mode?: "reset" | "invite" }) {
  const invite = mode === "invite";
  const router = useRouter();
  const toast = useToast();

  // For invite mode: verify the invitation token
  const {
    isLoading: isInspecting,
    isError: isInspectionError,
    error: inspectionError,
  } = useInspectInvitationQuery(invite ? token : "");

  // For reset password mutation
  const { mutate: mutateResetPassword, isPending: isResetting } = useResetPasswordMutation();

  // For resend reset link functionality
  const { mutate: mutateResend, isPending: isResending } = useForgotPasswordMutation();
  const [resendSubmitted, setResendSubmitted] = useState(false);
  const [isResetTokenExpired, setIsResetTokenExpired] = useState(!token);

  // Form for setting password
  const {
    control: resetControl,
    handleSubmit: handleResetSubmit,
    formState: { errors: resetErrors },
  } = useForm<{ password: string; confirmPassword: string }>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  // Form for resending password reset link
  const {
    register: registerResend,
    handleSubmit: handleResendSubmit,
    formState: { errors: resendErrors },
  } = useForm<ForgotPasswordPayload>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  /* ------------------------------------------------------------------ */
  /* INVITE MODE                                                        */
  /* ------------------------------------------------------------------ */
  if (invite) {
    if (!token) {
      return (
        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-8 sm:px-8 space-y-6 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-950/50 border border-amber-200/60 dark:border-amber-800/60 text-amber-600 dark:text-amber-400">
            <AlertCircle className="size-6" />
          </div>
          <div className="space-y-2">
            <h1 className="font-heading text-2xl font-medium text-foreground">Invitation link invalid</h1>
            <p className="text-sm text-muted-foreground">
              This invitation link is missing or invalid. Please ask your Super Administrator to resend your reviewer invitation.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline dark:text-amber-300"
            >
              <ArrowLeft className="size-4" />
              Back to sign in
            </Link>
          </div>
        </div>
      );
    }

    if (isInspecting) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 space-y-3 text-center">
          <Spinner className="size-8 text-primary" />
          <p className="text-sm text-muted-foreground">Verifying invitation link...</p>
        </div>
      );
    }

    if (isInspectionError) {
      const errorMessage =
        (inspectionError as Error)?.message ||
        "This invitation link has expired or is no longer valid. Reviewer invitations are single-use and time-limited. Please ask a Super Administrator to resend your invitation.";

      return (
        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-8 sm:px-8 space-y-6 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/50 border border-red-200/60 dark:border-red-800/60 text-red-600 dark:text-red-400">
            <Clock className="size-6" />
          </div>
          <div className="space-y-2">
            <h1 className="font-heading text-2xl font-medium text-foreground">Invitation expired</h1>
            <p className="text-sm text-muted-foreground">{errorMessage}</p>
          </div>
          <div className="pt-2">
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline dark:text-amber-300"
            >
              <ArrowLeft className="size-4" />
              Back to sign in
            </Link>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5 sm:px-8 space-y-6">
        <div className="space-y-1.5">
          <h1 className="font-heading text-2xl font-medium text-foreground">Create your password</h1>
          <p className="text-sm text-muted-foreground">
            Welcome to the ARB reviewer portal. Choose a password to activate your account — you&apos;ll use it with your work email to sign in.
          </p>
        </div>
        <form
          onSubmit={handleResetSubmit((data) =>
            mutateResetPassword(
              { token, ...data, invite: true },
              {
                onSuccess: () => {
                  toast.success("Account activated", "Sign in with your new password.");
                  router.push("/auth/login");
                },
                onError: (e: Error) => toast.error(e.message),
              }
            )
          )}
          noValidate
        >
          <FieldGroup>
            <Controller
              name="password"
              control={resetControl}
              render={({ field }) => (
                <Field data-invalid={!!resetErrors.password}>
                  <FieldLabel htmlFor="password">
                    New password<RequiredMark />
                  </FieldLabel>
                  <FieldContent>
                    <PasswordInput
                      id="password"
                      showStrength
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      ref={field.ref}
                    />
                    <FieldError errors={resetErrors.password ? [resetErrors.password] : []} />
                  </FieldContent>
                </Field>
              )}
            />
            <Controller
              name="confirmPassword"
              control={resetControl}
              render={({ field }) => (
                <Field data-invalid={!!resetErrors.confirmPassword}>
                  <FieldLabel htmlFor="confirmPassword">
                    Confirm password<RequiredMark />
                  </FieldLabel>
                  <FieldContent>
                    <PasswordInput
                      id="confirmPassword"
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      ref={field.ref}
                    />
                    <FieldError errors={resetErrors.confirmPassword ? [resetErrors.confirmPassword] : []} />
                  </FieldContent>
                </Field>
              )}
            />
            <Button type="submit" className="w-full" disabled={isResetting}>
              {isResetting && <Spinner className="size-4" />}
              Create password & activate
            </Button>
          </FieldGroup>
        </form>
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /* RESET PASSWORD MODE                                                */
  /* ------------------------------------------------------------------ */
  if (isResetTokenExpired) {
    if (resendSubmitted) {
      return (
        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-6 sm:px-8 space-y-6 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/60 dark:border-emerald-800/60 text-emerald-600 dark:text-emerald-400">
            <MailCheck className="size-5" />
          </div>
          <div className="space-y-1.5">
            <h1 className="font-heading text-2xl font-medium text-foreground">Check your email</h1>
            <p className="text-sm text-muted-foreground">
              If an active reviewer account exists for that email, we&apos;ve queued a new password reset link.
            </p>
          </div>
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline dark:text-amber-300"
          >
            <ArrowLeft className="size-4" />
            Back to sign in
          </Link>
        </div>
      );
    }

    return (
      <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5 sm:px-8 space-y-6">
        <div className="text-center space-y-3">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-950/50 border border-amber-200/60 dark:border-amber-800/60 text-amber-600 dark:text-amber-400">
            <Clock className="size-6" />
          </div>
          <div className="space-y-1">
            <h1 className="font-heading text-2xl font-medium text-foreground">Reset link expired or invalid</h1>
            <p className="text-sm text-muted-foreground">
              This password reset link is missing, expired, or has already been used. Enter your work email below to receive a new link.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleResendSubmit((data) =>
            mutateResend(data, {
              onSuccess: () => {
                setResendSubmitted(true);
                toast.success("Reset link sent", "Check your email for a new link.");
              },
              onError: (e: Error) => toast.error(e.message),
            })
          )}
          noValidate
        >
          <FieldGroup>
            <Field data-invalid={!!resendErrors.email}>
              <FieldLabel htmlFor="resend-email">
                Work email<RequiredMark />
              </FieldLabel>
              <FieldContent>
                <Input
                  id="resend-email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@clubatibis.com"
                  aria-invalid={!!resendErrors.email}
                  {...registerResend("email")}
                />
                <FieldError errors={resendErrors.email ? [resendErrors.email] : []} />
              </FieldContent>
            </Field>
            <Button type="submit" className="w-full" disabled={isResending}>
              {isResending ? <Spinner className="size-4" /> : <RotateCw className="size-4 mr-1.5" />}
              Resend reset link
            </Button>
          </FieldGroup>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          <Link href="/auth/login" className="font-medium text-primary hover:underline dark:text-amber-300">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5 sm:px-8 space-y-6">
      <div className="space-y-1.5">
        <h1 className="font-heading text-2xl font-medium text-foreground">Set a new password</h1>
        <p className="text-sm text-muted-foreground">
          Choose a strong password for your reviewer account.
        </p>
      </div>
      <form
        onSubmit={handleResetSubmit((data) =>
          mutateResetPassword(
            { token, ...data, invite: false },
            {
              onSuccess: () => {
                toast.success("Password updated", "Sign in with your new password.");
                router.push("/auth/login");
              },
              onError: (e: Error) => {
                const msg = e.message.toLowerCase();
                if (msg.includes("expired") || msg.includes("invalid") || msg.includes("token")) {
                  setIsResetTokenExpired(true);
                }
                toast.error(e.message);
              },
            }
          )
        )}
        noValidate
      >
        <FieldGroup>
          <Controller
            name="password"
            control={resetControl}
            render={({ field }) => (
              <Field data-invalid={!!resetErrors.password}>
                <FieldLabel htmlFor="password">
                  New password<RequiredMark />
                </FieldLabel>
                <FieldContent>
                  <PasswordInput
                    id="password"
                    showStrength
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    ref={field.ref}
                  />
                  <FieldError errors={resetErrors.password ? [resetErrors.password] : []} />
                </FieldContent>
              </Field>
            )}
          />
          <Controller
            name="confirmPassword"
            control={resetControl}
            render={({ field }) => (
              <Field data-invalid={!!resetErrors.confirmPassword}>
                <FieldLabel htmlFor="confirmPassword">
                  Confirm password<RequiredMark />
                </FieldLabel>
                <FieldContent>
                  <PasswordInput
                    id="confirmPassword"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    ref={field.ref}
                  />
                  <FieldError errors={resetErrors.confirmPassword ? [resetErrors.confirmPassword] : []} />
                </FieldContent>
              </Field>
            )}
          />
          <Button type="submit" className="w-full" disabled={isResetting}>
            {isResetting && <Spinner className="size-4" />}
            Update password
          </Button>
        </FieldGroup>
      </form>
      <div className="text-center pt-2">
        <button
          type="button"
          onClick={() => setIsResetTokenExpired(true)}
          className="text-xs text-muted-foreground hover:text-primary underline cursor-pointer"
        >
          Need a new reset link? Resend here
        </button>
      </div>
    </div>
  );
}
