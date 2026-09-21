import { db, delay } from "@/lib/mock/store";

function toPublic(reviewer: Reviewer): PublicReviewer {
  const { password: _password, ...rest } = reviewer;
  return rest;
}

export async function getCurrentUser(): Promise<PublicReviewer | null> {
  if (typeof window === "undefined") return null;
  if (localStorage.getItem("carv.logged-out") === "true") return null;

  const stored = localStorage.getItem("rv-auth-user");
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored) as PublicReviewer;
    const found = db.getReviewers().find((r) => r.id === parsed?.id && r.loginEnabled);
    return delay(found ? toPublic(found) : null, 40);
  } catch {
    return null;
  }
}

export async function loginUser(credentials: LoginCredentials): Promise<PublicReviewer> {
  const match = db.getReviewers().find((r) => r.email.toLowerCase() === credentials.email.trim().toLowerCase());
  if (!match || !match.password || match.password !== credentials.password) {
    await delay(null, 150);
    if (match && match.inviteStatus === "invited") {
      throw new Error("Your account is not set up yet. Use the invitation link emailed to you to create a password.");
    }
    throw new Error("Invalid email or password.");
  }
  if (!match.loginEnabled) {
    await delay(null, 150);
    throw new Error("This account is inactive. Contact the Super Admin to have it reactivated.");
  }
  const reviewers = db.getReviewers();
  db.setReviewers(reviewers.map((r) => (r.id === match.id ? { ...r, lastLoginAt: new Date().toISOString() } : r)));
  return delay(toPublic({ ...match, lastLoginAt: new Date().toISOString() }), 180);
}

export async function requestPasswordReset({ email }: ForgotPasswordPayload): Promise<void> {
  const match = db.getReviewers().find((r) => r.email.toLowerCase() === email.trim().toLowerCase() && r.loginEnabled);
  // Always resolve the same way so the form never reveals which emails exist.
  if (match) {
    console.info(`[mock email] Password reset link: /auth/reset-password?token=${btoa(match.id)}`);
  }
  return delay(undefined, 200);
}

/** Used by both "reset password" and the first-time "create password" invitation link. */
export async function resetPassword({ token, password }: ResetPasswordPayload): Promise<void> {
  let reviewerId: string;
  try {
    reviewerId = atob(token);
  } catch {
    await delay(null, 150);
    throw new Error("This link is invalid or has expired.");
  }
  const reviewers = db.getReviewers();
  const idx = reviewers.findIndex((r) => r.id === reviewerId);
  if (idx === -1) {
    await delay(null, 150);
    throw new Error("This link is invalid or has expired.");
  }
  const next = [...reviewers];
  next[idx] = { ...next[idx], password, inviteStatus: "active" };
  db.setReviewers(next);
  return delay(undefined, 180);
}

