import axiosInstance from "@/lib/axios";

/** Shape the backend's `publicUser` presenter returns for a REVIEWER account. */
interface ReviewerApiUser {
  _id: string;
  firstName: string;
  lastName: string;
  employeeNumber: string;
  designation?: string | null;
  email: string;
  accountStatus: string;
  credentialStatus: string;
  isDefaultReviewer: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

function toPublicReviewer(u: ReviewerApiUser): PublicReviewer {
  return {
    id: u._id,
    name: `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim(),
    employeeNumber: u.employeeNumber ?? "",
    designation: u.designation ?? "",
    email: u.email,
    receiveNewRequests: !!u.isDefaultReviewer,
    loginEnabled: u.accountStatus !== "DISABLED" && u.accountStatus !== "DELETED",
    inviteStatus: u.credentialStatus === "SET" ? "active" : "invited",
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt ?? undefined,
  };
}

export async function getCurrentUser(): Promise<PublicReviewer | null> {
  if (typeof window === "undefined") return null;
  if (!localStorage.getItem("rv-auth-token")) return null;
  try {
    const { data } = await axiosInstance.get("/auth/me");
    return toPublicReviewer(data.data.user);
  } catch {
    return null;
  }
}

/** Real login. Callers store `token` (as `rv-auth-token`) themselves — see login-form.tsx. */
export async function loginUser(credentials: LoginCredentials): Promise<{ token: string; user: PublicReviewer }> {
  const { data } = await axiosInstance.post("/auth/login", { ...credentials, role: "REVIEWER" });
  return { token: data.data.token, user: toPublicReviewer(data.data.user) };
}

export async function logoutUser(): Promise<void> {
  const token = typeof window !== "undefined" ? localStorage.getItem("rv-auth-token") : null;
  if (!token) return;
  try {
    await axiosInstance.post("/auth/logout", null, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // Best-effort — the caller clears the local session regardless.
  }
}

export async function requestPasswordReset({ email }: ForgotPasswordPayload): Promise<void> {
  // Always resolves the same way regardless of whether the email exists —
  // the backend never reveals that, and the form doesn't either.
  await axiosInstance.post("/auth/password-reset-requests", { email, role: "REVIEWER" });
}

export interface TokenInspectionResult {
  expiresAt: string;
}

/** Verify/preview a reviewer invitation link without consuming the token. */
export async function inspectInvitation(token: string): Promise<TokenInspectionResult> {
  const { data } = await axiosInstance.get("/auth/reviewer-invitations", {
    params: { token },
  });
  return data.data;
}

/** Accept a reviewer invitation and create first-time credentials. */
export async function acceptInvitation(payload: { token: string; password: string }): Promise<{ user: PublicReviewer }> {
  const { data } = await axiosInstance.post("/auth/reviewer-invitations/accept", payload);
  return { user: toPublicReviewer(data.data.user) };
}

/**
 * Used by both "reset password" (mode="reset") and the first-time "create
 * password" invitation link (mode="invite") — these are two different
 * backend endpoints with different semantics (a reset only works for an
 * account that already has credentials; an invitation accept is how a
 * freshly-invited reviewer sets credentials for the first time), so the
 * caller's `invite` flag picks between them rather than guessing from the
 * token shape.
 */
export async function resetPassword({ token, password, invite }: ResetPasswordPayload & { invite?: boolean }): Promise<void> {
  if (invite) {
    await acceptInvitation({ token, password });
  } else {
    await axiosInstance.post("/auth/password-resets", { token, newPassword: password });
  }
}

/**
 * Changing your own password revokes the token that made this very request
 * (the backend invalidates every token issued before the change) — the
 * caller must treat success as an implicit logout, not just a toast.
 */
export async function changePassword(payload: ChangePasswordPayload): Promise<void> {
  await axiosInstance.post("/auth/password-changes", {
    currentPassword: payload.currentPassword,
    newPassword: payload.newPassword,
  });
}
