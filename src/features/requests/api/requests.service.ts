import { db, delay } from "@/lib/mock/store";

export async function getRequests(): Promise<RequestRecord[]> {
  const all = db.getRequests();
  return delay(
    [...all].sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1)),
    80
  );
}

export async function getResidents(): Promise<Resident[]> {
  return delay(db.getResidents(), 40);
}

export async function getCategories(): Promise<Category[]> {
  return delay(db.getCategories(), 40);
}

export async function getReviewers(): Promise<PublicReviewer[]> {
  return delay(
    db.getReviewers().map(({ password: _password, ...rest }) => rest),
    40
  );
}
