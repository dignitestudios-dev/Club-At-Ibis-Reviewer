export const PUBLIC_ROUTES = [
  "/",
  "/auth/login",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/create-password",
  // The reviewer-invitation email always links here (a backend-owned path —
  // see next.config.ts's rewrite to /auth/create-password).
  "/accept-invitation",
];

export const PROTECTED_ROUTES = [
  "/dashboard",
  "/my-requests",
  "/incoming",
  "/oversight",
  "/requests",
  "/forms",
  "/notifications",
  "/profile",
];

// Signed-in reviewers are sent away from the sign-in pages, but the emailed
// reset / invitation links stay reachable.
export const AUTH_PAGES = ["/auth/login", "/auth/forgot-password"];

export const AUTH_REDIRECT = "/auth/login";
export const DEFAULT_REDIRECT = "/dashboard";
