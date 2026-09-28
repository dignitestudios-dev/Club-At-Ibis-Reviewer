import axios from "axios";

const axiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "https://api.clubatibis.dignitestudios.com/api/v1",
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

axiosInstance.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("rv-auth-token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function clearSessionAndRedirect() {
  if (typeof window === "undefined") return;
  localStorage.setItem("carv.logged-out", "true");
  sessionStorage.setItem("carv.session-expired", "true");
  localStorage.removeItem("rv-auth-token");
  localStorage.removeItem("rv-auth-user");
  document.cookie = "rv-auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0";
  window.dispatchEvent(new CustomEvent("app:session-expired"));
  if (!window.location.pathname.startsWith("/auth/")) {
    const currentPath = window.location.pathname + window.location.search;
    const returnUrl = encodeURIComponent(currentPath);
    window.location.href = `/auth/login?reason=session-expired&returnUrl=${returnUrl}`;
  }
}

let isHandling403 = false;

function handleForbidden() {
  if (typeof window === "undefined") return;
  if (isHandling403) return;
  isHandling403 = true;

  window.dispatchEvent(
    new CustomEvent("app:toast", {
      detail: {
        variant: "error",
        title: "Permission Denied",
        description: "You do not have permission to this action, we are refreshing you account info",
      },
    })
  );

  setTimeout(() => {
    isHandling403 = false;
    if (window.location.pathname !== "/dashboard") {
      window.location.href = "/dashboard";
    } else {
      window.location.reload();
    }
  }, 1500);
}

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const isLoginAttempt = typeof error.config?.url === "string" && error.config.url.includes("/auth/login");
    const isLogoutAttempt = typeof error.config?.url === "string" && error.config.url.includes("/auth/logout");
    if (status === 401 && !isLoginAttempt && !isLogoutAttempt) clearSessionAndRedirect();

    // A 403 on an /auth/* call (login, registration, password flows, email
    // verification, reviewer invitations) is a pre-auth/self-auth business
    // rule — e.g. EMAIL_VERIFICATION_REQUIRED or ACCOUNT_SETUP_REQUIRED on
    // login — meant to be shown inline by that form's own error handler, not
    // treated as "you lack permission for an authenticated action" and
    // bounced to /dashboard. Without this check, a failed login attempt
    // would show the error toast and then get silently navigated away
    // (bouncing back to /auth/login via the proxy since there's no session),
    // wiping the just-shown error off the screen.
    const isAuthEndpoint = typeof error.config?.url === "string" && error.config.url.includes("/auth/");
    if (status === 403 && !isAuthEndpoint) {
      handleForbidden();
    }

    // Trigger server-error dialog on 5xx or network-down responses
    if (typeof window !== "undefined" && (!status || status >= 500 || error.code === "ERR_NETWORK")) {
      window.dispatchEvent(new CustomEvent("app:server-error"));
    }

    const message = error.response?.data?.message ?? error.message;
    return Promise.reject(new Error(message));
  }
);

export default axiosInstance;
