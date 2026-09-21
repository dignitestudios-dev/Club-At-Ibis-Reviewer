/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

interface LoginCredentials {
  email: string;
  password: string;
}

interface ForgotPasswordPayload {
  email: string;
}

interface ResetPasswordPayload {
  token: string;
  password: string;
  confirmPassword: string;
}

interface AuthState {
  user: PublicReviewer | null;
  status: "idle" | "loading" | "authenticated" | "unauthenticated";
}

/* ------------------------------------------------------------------ */
/* Accounts                                                            */
/* ------------------------------------------------------------------ */

interface Reviewer {
  id: string;
  name: string;
  employeeNumber: string;
  designation: string;
  email: string;
  password: string;
  /** "Receive New Requests" — the reviewer is a Default Reviewer. */
  receiveNewRequests: boolean;
  /** Account status. Inactive reviewers cannot sign in. */
  loginEnabled: boolean;
  inviteStatus: "invited" | "active";
  createdAt: string;
  lastLoginAt?: string;
}

type PublicReviewer = Omit<Reviewer, "password">;

interface Resident {
  id: string;
  residentIdNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address?: string;
  lotNo?: string;
  /** Inactive residents cannot sign in. */
  active: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

/* ------------------------------------------------------------------ */
/* Categories & form builder                                           */
/* ------------------------------------------------------------------ */

type CategoryFieldType =
  | "text"
  | "textarea"
  | "number"
  | "email"
  | "phone"
  | "date"
  | "time"
  | "select"
  | "radio"
  | "checkbox"
  | "file";

interface CategoryField {
  id: string;
  label: string;
  type: CategoryFieldType;
  required: boolean;
  helpText?: string;
  /** Choices for dropdown / multiple choice / checkbox fields. */
  options?: string[];
  /** File fields: accepted file groups. Empty / undefined means every type. */
  accept?: string[];
  /** File fields: allow more than one file. */
  multiple?: boolean;
  /** Display sequence in the resident form (1-based). */
  order: number;
}

type CategoryStatus = "active" | "archived";

interface CategoryVersion {
  version: number;
  name: string;
  description: string;
  fields: CategoryField[];
  createdAt: string;
  createdBy: string;
  /** Human-readable summary of what changed from the previous version. */
  changes: string[];
  note?: string;
}

interface Category {
  id: string;
  name: string;
  description: string;
  status: CategoryStatus;
  fields: CategoryField[];
  /** Incremented on every saved edit. New requests snapshot the version. */
  version: number;
  /** Every version ever saved, oldest first. The last entry is the current one. */
  versions: CategoryVersion[];
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

/* ------------------------------------------------------------------ */
/* Requests                                                            */
/* ------------------------------------------------------------------ */

type RequestStatus =
  | "submitted"
  | "under_review"
  | "changes_required"
  | "resubmitted"
  | "approved"
  | "rejected"
  | "completed"
  | "withdrawn";

interface AttachedFile {
  id: string;
  name: string;
  size: number;
  uploadedAt: string;
}

type HistoryEventType =
  | "submitted"
  | "assigned"
  | "reassigned"
  | "review_started"
  | "item_accepted"
  | "item_flagged"
  | "revision_requested"
  | "resubmitted"
  | "approved"
  | "rejected"
  | "deposit_required"
  | "receipt_recorded"
  | "letter_uploaded"
  | "completed"
  | "letter_email"
  | "withdrawn"
  | "refund_awaiting"
  | "refunded"
  | "no_refund";

type ActorRole = "resident" | "reviewer" | "super_admin" | "system";

interface HistoryEvent {
  id: string;
  type: HistoryEventType;
  actor: { name: string; role: ActorRole };
  message: string;
  detail?: string;
  createdAt: string;
  /** Set on assigned / reassigned events so the assignment log can show from → to. */
  assignment?: { from?: string; to: string };
  /** Staff-only records are not shown to the resident. */
  staffOnly?: boolean;
}

interface ItemReview {
  state: "accepted" | "flagged";
  reason?: string;
}

/** A submission as it was when the reviewer reviewed it — kept after the resident resubmits. */
interface SubmissionSnapshot {
  id: string;
  /** 1-based; the resident's original submission is 1. */
  number: number;
  submittedAt: string;
  /** When the reviewer sent it back for revision. */
  reviewedAt: string;
  fieldValues: Record<string, string>;
  uploads: Record<string, AttachedFile[]>;
  itemReviews: Record<string, ItemReview>;
  feedback?: string;
}

interface RequestRevision {
  id: string;
  fieldId: string;
  label: string;
  previous: string;
  current: string;
  at: string;
}

type DepositStatus = "not_required" | "pending" | "received";
type RefundOutcome = "awaiting" | "refunded" | "no_refund";

interface DepositRecord {
  required: boolean;
  amount?: number;
  status: DepositStatus;
  /** True once the reviewer has answered "Deposit Required?" (either way). */
  confirmed?: boolean;
  receipt?: AttachedFile;
  receivedAt?: string;
}

interface RefundRecord {
  outcome: RefundOutcome;
  /** Optional proof of refund / supporting document. */
  proof?: AttachedFile;
  recordedBy: string;
  date: string;
}

interface LetterEmailRecord {
  status: "sent";
  at: string;
}

interface RequestRecord {
  id: string;
  code: string;
  categoryId: string;
  /** Category name at time of submission — preserved when categories change. */
  categoryName: string;
  formVersion: number;
  formSnapshot: CategoryField[];
  residentId: string;
  status: RequestStatus;
  assignedReviewerId: string | null;
  fieldValues: Record<string, string>;
  uploads: Record<string, AttachedFile[]>;
  itemReviews: Record<string, ItemReview>;
  revisions: RequestRevision[];
  /** Earlier submissions, oldest first, retained when the resident resubmits. */
  previousSubmissions?: SubmissionSnapshot[];
  hoaApproved: boolean;
  hoaConfirmedAt: string;
  submittedAt: string;
  updatedAt: string;
  decidedAt?: string;
  completedAt?: string;
  withdrawnAt?: string;
  withdrawnFrom?: RequestStatus;
  feedback?: string;
  rejectionReason?: string;
  deposit: DepositRecord;
  refund?: RefundRecord;
  approvalLetter?: AttachedFile;
  letterEmail?: LetterEmailRecord;
  history: HistoryEvent[];
}

/* ------------------------------------------------------------------ */
/* Notifications, activity, resets                                     */
/* ------------------------------------------------------------------ */

type ReviewerNotificationType =
  | "new_assignment"
  | "incoming_request"
  | "form_updated"
  | "resubmission"
  | "request_update"
  | "withdrawal"
  | "action_required";

interface ReviewerNotification {
  id: string;
  /** The reviewer this notification is addressed to. */
  reviewerId: string;
  type: ReviewerNotificationType;
  title: string;
  message: string;
  requestId: string | null;
  /** Overrides the default link (the request) when set. */
  link?: string;
  read: boolean;
  createdAt: string;
}
