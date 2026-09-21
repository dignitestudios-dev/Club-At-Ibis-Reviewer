import type { Metadata } from "next";
import ResetPasswordForm from "@/features/auth/components/reset-password-form";

export const metadata: Metadata = { title: "Create Password · Club At Ibis Reviewer" };

export default async function CreatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <ResetPasswordForm token={token ?? ""} mode="invite" />;
}
