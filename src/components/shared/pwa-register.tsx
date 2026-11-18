"use client";

import { useEffect } from "react";

/** Registers the service worker, which browsers require before they offer to install the app. */
export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // Not fatal: the portal works fine without it, it just can't be installed.
      });
    }
  }, []);
  return null;
}
