import type { Metadata } from "next";
import { Suspense } from "react";
import LoginForm from "@/features/auth/components/login-form";

export const metadata: Metadata = { title: "Sign In · Club At Ibis Reviewer" };

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
