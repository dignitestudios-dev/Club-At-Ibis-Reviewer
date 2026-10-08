"use client";

import { useEffect, useRef } from "react";

/** Fired when a request action fails because the request changed elsewhere (HTTP 409). */
export const REQUEST_CONFLICT_EVENT = "app:request-conflict";

export function announceRequestConflict() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(REQUEST_CONFLICT_EVENT));
}

/**
 * Closes a dialog when the request it was opened for turns out to be stale. The dialog's inputs were based on
 * a version of the request that no longer exists, so the reviewer should look at the refreshed page first.
 * Every request dialog calls this, so no dialog can stay open over outdated data.
 */
export function useCloseOnConflict(open: boolean, close: () => void) {
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });
  useEffect(() => {
    if (!open) return;
    const handler = () => closeRef.current();
    window.addEventListener(REQUEST_CONFLICT_EVENT, handler);
    return () => window.removeEventListener(REQUEST_CONFLICT_EVENT, handler);
  }, [open]);
}
