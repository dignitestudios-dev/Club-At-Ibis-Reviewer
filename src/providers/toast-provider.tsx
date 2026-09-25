"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { ToastViewport } from "@/components/shared/toast/toast-viewport";

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_DURATION_MS = 4000;

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const lastSessionExpiryToastRef = useRef<number>(0);

  function dismiss(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  function show(variant: ToastVariant, title: string, description?: string) {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, variant, title, description }]);
    setTimeout(() => dismiss(id), TOAST_DURATION_MS);
  }

  useEffect(() => {
    const handleSessionExpired = () => {
      const now = Date.now();
      if (now - lastSessionExpiryToastRef.current < 4000) return;
      lastSessionExpiryToastRef.current = now;
      show("error", "Session Expired", "Your session has expired. Please sign in again.");
    };

    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const isExpiredQuery = urlParams.get("reason") === "session-expired";
      const isExpiredStorage = sessionStorage.getItem("carv.session-expired") === "true";

      if (isExpiredQuery || isExpiredStorage) {
        sessionStorage.removeItem("carv.session-expired");
        // Clear reason from URL cleanly without reload
        if (isExpiredQuery) {
          urlParams.delete("reason");
          const newSearch = urlParams.toString();
          const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : "") + window.location.hash;
          window.history.replaceState(null, "", newUrl);
        }
        handleSessionExpired();
      }

      window.addEventListener("app:session-expired", handleSessionExpired);
      return () => {
        window.removeEventListener("app:session-expired", handleSessionExpired);
      };
    }
  }, []);

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToastContext() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToastContext must be used inside <ToastProvider>");
  return ctx;
}
