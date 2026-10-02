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

interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
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
  /** "Receive New Requests": the reviewer is a Default Reviewer. */
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
  /** "common" = the shared Project Information fields on every category; "category" = fields specific to this category's form. */
  source?: "common" | "category";
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
  | "assigned"
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
  url?: string;
  mimeType?: string;
  originalName?: string;
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
  /** Set on a "revision-requested" event: the exact fields flagged for that review round, with the reviewer's reason. The `submissions[]`/`previousSubmissions[]` records never carry per-round item reviews, so this is the only place a past round's flagged items are reconstructable from. */
  flaggedItems?: { fieldId: string; label: string; reason: string }[];
  /** The submission round this event applies to (present on flag/accept/revision-requested/resubmitted events). */
  submissionNumber?: number;
}

interface ItemReview {
  state: "accepted" | "flagged" | "pending";
  reason?: string;
}

type ReviewItemDecision = "pending" | "accepted" | "flagged";

interface ReviewItemRecord {
  key?: string;
  kind: "field" | "file";
  fieldId: string;
  /** Set when kind === "file": identifies which uploaded file this item covers. */
  fileId?: string;
  label: string;
  decision: ReviewItemDecision;
  reason: string | null;
  decidedBy?: { actorId: string; role: string; displayName: string } | null;
  decidedAt?: string | null;
  carriedForward?: boolean;
}

interface ActiveReviewRound {
  id: string;
  requestId?: string;
  submissionId?: string;
  roundNumber: number;
  status: "active" | "approved" | "rejected" | "revision_requested";
  reviewVersion: number;
  items: ReviewItemRecord[];
  startedBy?: { actorId: string; role: string; displayName: string };
  startedAt?: string;
  closedBy?: { actorId: string; role: string; displayName: string };
  closedAt?: string;
}

interface SubmissionVersionRecord {
  id: string;
  number: number;
  submittedAt: string;
  changedFieldIds: string[];
  fieldValues: Record<string, string>;
  files: Record<string, AttachedFile[]>;
  formSnapshot?: CategoryField[];
}

/** A submission as it was when the reviewer reviewed it (kept after the resident resubmits). */
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
type RefundOutcome = "awaiting" | "awaiting_refund_action" | "refunded" | "no_refund";
type EmailDeliveryStatus = "PENDING" | "PROCESSING" | "SENT" | "FAILED" | "CANCELED";

interface DepositRecord {
  required: boolean;
  amount?: number | string | null;
  amountMinor?: number | null;
  status: DepositStatus;
  /** True once the reviewer has answered "Deposit Required?" (either way). */
  confirmed?: boolean;
  receipt?: AttachedFile | null;
  receivedAt?: string | null;
}

interface CompletionEmailRecord {
  status: EmailDeliveryStatus;
  attemptCount: number;
  retryCycle: number;
  sentAt?: string | null;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
}

interface RequestCompletion {
  completedAt: string | null;
  completedBy?: { id?: string; actorId?: string; name?: string; email?: string; displayName?: string } | null;
  finalApprovalLetter?: AttachedFile | null;
  email?: CompletionEmailRecord | null;
}

interface RequestWithdrawal {
  withdrawnAt: string | null;
  withdrawnBy?: { id?: string; actorId?: string; name?: string; role?: string; displayName?: string } | null;
  withdrawnFrom?: RequestStatus | null;
  residentContactAcknowledged?: boolean;
}

interface RefundRecord {
  outcome: RefundOutcome | null;
  refundDate?: string | null;
  displayValue?: string | null;
  explanation?: string | null;
  /** Optional proof of refund / supporting document. */
  proof?: AttachedFile | null;
  recordedBy?: string | null;
  recordedAt?: string | null;
  date?: string | null;
  correctionReason?: string | null;
}

interface LetterEmailRecord {
  status: "sent" | EmailDeliveryStatus;
  at?: string;
  sentAt?: string | null;
}

interface RequestResidentSnapshot {
  id: string;
  residentId?: string;
  residentIdNumber?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  email?: string;
  phone?: string;
}

interface RequestPropertySnapshot {
  address?: string | null;
  lotNo?: string | null;
  subDivision?: string | null;
  parcelId?: string | null;
}

interface RequestRecord {
  id: string;
  code: string;
  title?: string;
  categoryId: string;
  /** Category name at time of submission (preserved when categories change). */
  categoryName: string;
  categorySlug?: string;
  category?: { id: string; slug: string; name: string };
  formVersion: number;
  formSnapshot: CategoryField[];
  residentId: string;
  resident?: RequestResidentSnapshot;
  property?: RequestPropertySnapshot;
  status: RequestStatus;
  assignedReviewerId: string | null;
  assignmentVersion?: number;
  workflowVersion?: number;
  mediaRevision?: number;
  activeReviewId?: string | null;
  review?: ActiveReviewRound | null;
  submissions?: SubmissionVersionRecord[];
  revision?: {
    revisionVersion: number;
    items: Array<{ fieldId: string; label: string; reason: string }>;
    feedback?: string;
  } | null;
  decision?: {
    rejectionReason: string | null;
    decidedAt: string | null;
    decidedBy?: { actorId: string; role: string; displayName: string } | null;
  } | null;
  draftRevision?: number | null;
  currentStep?: number | null;
  fieldValues: Record<string, string>;
  uploads: Record<string, AttachedFile[]>;
  itemReviews: Record<string, ItemReview>;
  /** Same as itemReviews but keyed by fileId — a file field can hold several files, each with its own review item, so they can't share the fieldId-keyed map without colliding. */
  fileItemReviews: Record<string, ItemReview>;
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
  completion?: RequestCompletion | null;
  withdrawal?: RequestWithdrawal | null;
  refund?: RefundRecord | null;
  approvalLetter?: AttachedFile | null;
  letterEmail?: LetterEmailRecord | null;
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
  read: boolean;
  createdAt: string;
}
