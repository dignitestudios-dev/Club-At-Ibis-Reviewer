import { seedResidents, seedReviewers } from "./people";
import { seedCategories } from "./categories";
import { seedRequests } from "./requests";
import { seedNotifications } from "./system";

// Bump whenever the seed data shape changes so stale localStorage from a
// previous schema gets replaced instead of causing runtime errors.
const SCHEMA_VERSION = "3";

const KEYS = {
  version: "carv.schema-version",
  reviewers: "carv.reviewers",
  residents: "carv.residents",
  categories: "carv.categories",
  requests: "carv.requests",
  notifications: "carv.notifications",
} as const;

function isBrowser() {
  return typeof window !== "undefined";
}

function read<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (!isBrowser()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function seedAll() {
  write(KEYS.reviewers, seedReviewers);
  write(KEYS.residents, seedResidents);
  write(KEYS.categories, seedCategories);
  write(KEYS.requests, seedRequests);
  write(KEYS.notifications, seedNotifications);
}

function ensureSeeded() {
  if (!isBrowser()) return;
  if (window.localStorage.getItem(KEYS.version) !== SCHEMA_VERSION) {
    seedAll();
    window.localStorage.setItem(KEYS.version, SCHEMA_VERSION);
  }
}

export function delay<T>(value: T, ms = 80): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export const db = {
  getReviewers(): Reviewer[] {
    ensureSeeded();
    return read(KEYS.reviewers, seedReviewers);
  },
  setReviewers(reviewers: Reviewer[]) {
    write(KEYS.reviewers, reviewers);
  },
  getResidents(): Resident[] {
    ensureSeeded();
    return read(KEYS.residents, seedResidents);
  },
  getCategories(): Category[] {
    ensureSeeded();
    return read(KEYS.categories, seedCategories);
  },
  getRequests(): RequestRecord[] {
    ensureSeeded();
    return read(KEYS.requests, seedRequests);
  },
  setRequests(requests: RequestRecord[]) {
    write(KEYS.requests, requests);
  },
  getNotifications(): ReviewerNotification[] {
    ensureSeeded();
    return read(KEYS.notifications, seedNotifications);
  },
  setNotifications(notifications: ReviewerNotification[]) {
    write(KEYS.notifications, notifications);
  },
};

/** The signed-in reviewer, always re-read from the store so admin changes apply immediately. */
export function currentReviewer(): Reviewer {
  let id: string | undefined;
  if (isBrowser()) {
    try {
      const raw = window.localStorage.getItem("rv-auth-user");
      if (raw) id = (JSON.parse(raw) as PublicReviewer)?.id;
    } catch {
      // ignore
    }
  }
  const reviewer = db.getReviewers().find((r) => r.id === id);
  if (!reviewer) throw new Error("Your session has expired. Please sign in again.");
  if (!reviewer.loginEnabled) throw new Error("Your account is inactive.");
  return reviewer;
}

/** Adds an in-app notification for another reviewer. */
export function pushNotification(input: Pick<ReviewerNotification, "reviewerId" | "type" | "title" | "message" | "requestId">) {
  db.setNotifications([
    { ...input, id: crypto.randomUUID(), read: false, createdAt: new Date().toISOString() },
    ...db.getNotifications(),
  ]);
}
