import type { Metadata } from "next";
import ForgotPasswordForm from "@/features/auth/components/forgot-password-form";

export const metadata: Metadata = { title: "Forgot Password · Club At Ibis Reviewer" };

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
