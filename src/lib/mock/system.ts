import { seedResidents, seedReviewers } from "./people";
import { seedRequests } from "./requests";
import { seedCategories } from "./categories";

function residentName(id: string) {
  const r = seedResidents.find((x) => x.id === id);
  return r ? `${r.firstName} ${r.lastName}` : "Resident";
}

const RECENT_MS = 14 * 24 * 60 * 60 * 1000;
const UNREAD_MS = 3 * 24 * 60 * 60 * 1000;

/* ------------------------------------------------------------------ */
/* Reviewer notifications — derived from each request's history         */
/* ------------------------------------------------------------------ */

function buildNotifications(): ReviewerNotification[] {
  const out: ReviewerNotification[] = [];
  const now = Date.now();
  const defaults = seedReviewers.filter((r) => r.receiveNewRequests && r.loginEnabled);

  const push = (reviewerId: string, key: string, n: Omit<ReviewerNotification, "id" | "reviewerId" | "read">) => {
    if (now - new Date(n.createdAt).getTime() > RECENT_MS) return;
    out.push({ ...n, id: `n-${reviewerId}-${key}`, reviewerId, read: now - new Date(n.createdAt).getTime() > UNREAD_MS });
  };

  for (const req of seedRequests) {
    const who = residentName(req.residentId);
    const owner = req.assignedReviewerId;

    if (!owner && req.status === "submitted") {
      for (const d of defaults) {
        push(d.id, `incoming-${req.id}`, {
          type: "incoming_request",
          title: "New incoming request",
          message: `${who} submitted a ${req.categoryName} request (${req.code}). Take ownership or assign it to a reviewer.`,
          requestId: req.id,
          createdAt: req.submittedAt,
        });
      }
    }

    for (const event of req.history) {
      if (event.type === "assigned" || event.type === "reassigned") {
        const target = seedReviewers.find((r) => r.name === event.assignment?.to);
        if (target && event.actor.name !== target.name) {
          push(target.id, event.id, {
            type: "new_assignment",
            title: event.type === "reassigned" ? "Request reassigned to you" : "New assignment",
            message: `${req.code} · ${req.categoryName} for ${who} was assigned to you by ${event.actor.name}.`,
            requestId: req.id,
            createdAt: event.createdAt,
          });
        }
      } else if (event.type === "resubmitted" && owner) {
        push(owner, event.id, {
          type: "resubmission",
          title: "Resubmission received",
          message: `${who} resubmitted ${req.code} with corrected items — ready for your review.`,
          requestId: req.id,
          createdAt: event.createdAt,
        });
      } else if (event.type === "withdrawn") {
        const message = `${who} withdrew ${req.code}${req.deposit.status === "received" ? " — a deposit was received, so a refund outcome is needed." : "."}`;
        const recipients = owner ? [owner] : defaults.map((d) => d.id);
        recipients.forEach((id) =>
          push(id, event.id, { type: "withdrawal", title: "Request withdrawn", message, requestId: req.id, createdAt: event.createdAt })
        );
      }
    }

    if (owner && req.status === "withdrawn" && req.deposit.status === "received" && !req.refund) {
      push(owner, `refund-${req.id}`, {
        type: "action_required",
        title: "Refund outcome needed",
        message: `${req.code} was withdrawn after a deposit was received. Record Refund to be made or No Refund.`,
        requestId: req.id,
        createdAt: req.withdrawnAt ?? req.updatedAt,
      });
    }
    if (owner && req.refund?.outcome === "awaiting") {
      push(owner, `refund-${req.id}`, {
        type: "action_required",
        title: "Refund awaiting action",
        message: `${req.code} is awaiting a refund. Mark it Refunded once the refund has been made outside the app.`,
        requestId: req.id,
        createdAt: req.refund.date,
      });
    }
  }

  // Form updates: every active reviewer is told when a category's form changes.
  for (const cat of seedCategories) {
    if (cat.version < 2) continue;
    const latest = cat.versions[cat.versions.length - 1];
    const summary = latest.changes.slice(0, 2).join("; ");
    for (const rv of seedReviewers.filter((r) => r.loginEnabled)) {
      push(rv.id, `form-${cat.id}-v${latest.version}`, {
        type: "form_updated",
        title: `Form updated · ${cat.name} (v${latest.version})`,
        message: `${latest.createdBy} updated the ${cat.name} form. ${summary}. Open the comparison to see what was and what is new.`,
        requestId: null,
        link: `/forms/${cat.id}?from=${latest.version - 1}&to=${latest.version}`,
        createdAt: latest.createdAt,
      });
    }
  }

  return out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export const seedNotifications: ReviewerNotification[] = buildNotifications();
