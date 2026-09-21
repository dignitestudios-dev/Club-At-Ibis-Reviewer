export const PUBLIC_ROUTES = [
  "/",
  "/auth/login",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/create-password",
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
