# Club At Ibis — ARB Reviewer Portal (UI prototype)

The reviewer interface for the Architectural Review Board. Same theme and design system as the resident portal and the Super Admin console (navy/gold, Playfair Display + Raleway, dark mode). UI only: all data is mocked in `localStorage` (`carv.*` keys), so it resets with `localStorage.clear()`.

```bash
npm install
npm run dev -- -p 3200
```

Demo accounts (password `reviewer123`)

| Account | Role |
| --- | --- |
| `marcus.vance@clubatibis.com` | Default reviewer (sees Incoming + Oversight) — pre-filled on the login screen |
| `elena.rodriguez@clubatibis.com` | Default reviewer |
| `jordan.whitfield@clubatibis.com` | Regular reviewer (assigned requests only) |

`thomas.okafor@clubatibis.com` is an invited reviewer who has not created a password yet. Their invitation link is `/auth/create-password?token=<btoa(reviewerId)>` (token for `rev-5`: `cmV2LTU=`).

## What is implemented (spec §4)

**4.1 Work lists**
- **Dashboard** — needs-attention list, my workload, up-next queue, status donut, recent notifications.
- **My Assigned Requests** — Active / History tabs, search, status + category filters, URL-persisted state, page-size select.
- **Incoming Requests** *(default reviewers)* — take ownership or assign to any active reviewer.
- **Request Oversight** *(default reviewers)* — every reviewer's requests, track progress, reassign.
- **Form Updates** — every form with what changed in its latest version, and a version-to-version comparison page (`/forms/[id]?from=&to=`). Editing a form notifies reviewers with a link to the comparison; each request shows the version it was submitted on and the latest one.
- **Notifications** — new assignments, incoming, resubmissions, withdrawals, actions required.
- **Profile** — read-only name, employee number, designation, email.

**4.2 Review** — Start review → Under Review; the review screen has a green/amber progress bar, an optional note per flagged item (feedback on the revision request is required) and retained earlier submissions; per-field/file Accept or Flag (mandatory reason); re-flag an accepted item until approval; Request revision (feedback + flagged items) / Reject (mandatory reason, confirm) / Approve (blocked until every item is accepted). After approval, revision and rejection disappear. Resubmitted items are marked “Updated by resident” with the previous value; history and retained versions are on the request.

**4.3 Completion** — Deposit required? (No → letter; Yes → amount, Pending → upload receipt → Received), upload the final approval letter, Mark completed (missing-requirement list when something is outstanding). Completion emails the letter, and a completed request has a **Resend approval email** button that sends it again without completing the request a second time.

**4.4 Withdrawal & refund** — deposit not received → no action; received → record *Refund to be made* (stays “Awaiting refund action”, then **Mark Refunded**) or *No Refund* (shown as “-” with an explanatory label). Both can carry an optional proof file. Everything is written to the request history and notes that the resident is notified.

## Notes
- Only the assigned reviewer can act on a request; a default reviewer can view any request read-only and reassign it. After reassignment the previous reviewer loses access.
- Sessions use the `rv-auth-token` cookie and `rv-auth-user` key so they don't collide with the other apps on `localhost`.
- Assignment, reviewer status (default / active) and reviewer accounts are managed by the Super Admin app; this prototype seeds its own copy of that data.
