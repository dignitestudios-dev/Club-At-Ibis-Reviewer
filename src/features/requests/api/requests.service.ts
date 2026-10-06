import axiosInstance from "@/lib/axios";

/** The `withdrawal` object has no "from" status; the withdraw history event records it as `details.previousStatus`. */
function withdrawnFromHistory(history: any[] | undefined): string | undefined {
  const event = history?.find((h) => h?.type === "request.withdrawn");
  return event?.details?.previousStatus ?? undefined;
}

/** Actor objects ({ actorId, role, displayName }) -> a display name. */
function actorName(actor: any): string | null {
  if (!actor) return null;
  return typeof actor === "string" ? actor : (actor.displayName ?? actor.name ?? null);
}

/**
 * The backend identifies who recorded a refund with an actor object ({ actorId, role, displayName }),
 * but the UI shows a plain name — rendering the object crashes the page.
 */
function normalizeRefund(refund: any) {
  if (!refund || typeof refund !== "object") return null;
  const by = refund.recordedBy;
  return { ...refund, recordedBy: typeof by === "string" ? by : (by?.displayName ?? by?.name ?? null) };
}

const knownResidents = new Map<string, Resident>();

export function toReviewerRequestRecord(raw: any): RequestRecord {
  const code = raw.reference || raw.code || "ARB-PENDING";
  const catId = raw.categoryId || raw.requestTypeId || raw.category?.id || "";
  const catName = raw.category?.name || raw.categoryName || "";
  const residentId = raw.residentId || raw.resident?.id || raw.resident?._id || "";

  // Extract resident snapshot into local cache if present on the request
  if (raw.resident || raw.residentSnapshot) {
    const r = raw.resident || raw.residentSnapshot;
    const resId = r.id || r._id || residentId;
    if (resId) {
      knownResidents.set(resId, {
        id: resId,
        residentIdNumber: r.residentId || r.residentIdNumber || `RES-${resId.slice(-5)}`,
        firstName: r.firstName || "",
        lastName: r.lastName || "",
        email: r.email || "",
        phone: r.phone || "",
        address: raw.property?.address || raw.fieldValues?.propertyAddress || "",
        lotNo: raw.property?.lotNo || raw.fieldValues?.lotNo || "",
        active: true,
        createdAt: r.createdAt || new Date().toISOString(),
      });
    }
  }

  const fieldValues = { ...(raw.fieldValues || {}) };
  if (raw.property?.address && !fieldValues.propertyAddress) {
    fieldValues.propertyAddress = raw.property.address;
  }
  if (raw.property?.lotNo && !fieldValues.lotNo) {
    fieldValues.lotNo = raw.property.lotNo;
  }

  const rawUploads = raw.files || raw.uploads || {};
  const uploads: Record<string, AttachedFile[]> = {};
  for (const [key, val] of Object.entries(rawUploads)) {
    if (Array.isArray(val)) {
      uploads[key] = val.map((f: any) => ({
        id: f.id || f._id || crypto.randomUUID(),
        name: f.name || f.originalName || f.filename || "file",
        originalName: f.originalName || f.filename || f.name || "file",
        size: f.size || 0,
        mimeType: f.mimeType || "application/octet-stream",
        uploadedAt: f.uploadedAt || f.createdAt || new Date().toISOString(),
        url: f.url || "",
      }));
    }
  }

  const itemReviews: Record<string, ItemReview> = { ...(raw.itemReviews || {}) };
  // A file field can hold several files, each getting its own review item
  // (kind: "file", keyed by fileId) — those can't share the fieldId-keyed
  // itemReviews map above without one file's state overwriting another's.
  const fileItemReviews: Record<string, ItemReview> = {};
  let review: ActiveReviewRound | null = null;
  if (raw.review) {
    review = {
      id: raw.review.id || raw.review._id || crypto.randomUUID(),
      roundNumber: raw.review.roundNumber ?? 1,
      status: raw.review.status || "active",
      reviewVersion: raw.review.reviewVersion ?? 0,
      items: Array.isArray(raw.review.items)
        ? raw.review.items.map((it: any) => {
            const decision: ReviewItemDecision =
              it.decision === "accepted" || it.decision === "flagged" ? it.decision : "pending";
            const itemState: ItemReview = { state: decision, reason: it.reason || undefined };
            if (it.kind === "file" && it.fileId) {
              fileItemReviews[it.fileId] = itemState;
            } else {
              itemReviews[it.fieldId] = itemState;
            }
            return {
              key: it.key || (it.kind === "file" && it.fileId ? `file:${it.fileId}` : `field:${it.fieldId}`),
              kind: it.kind || "field",
              fieldId: it.fieldId,
              fileId: it.fileId || undefined,
              label: it.label || "",
              decision,
              reason: it.reason || null,
              decidedBy: it.decidedBy || null,
              decidedAt: it.decidedAt || null,
              carriedForward: !!it.carriedForward,
            };
          })
        : [],
      startedBy: raw.review.startedBy,
      startedAt: raw.review.startedAt,
      closedBy: raw.review.closedBy,
      closedAt: raw.review.closedAt,
    };
  }

  // The reviewer's general feedback for a past round only survives on that
  // round's "revision-requested" history event — `submissions[]` never
  // carries it — so look it up per submissionNumber the same way flagged
  // items are reconstructed in lib/domain.ts's flaggedItemsForSubmission.
  const feedbackBySubmissionNumber = new Map<number, string>();
  if (Array.isArray(raw.history)) {
    for (const h of raw.history) {
      const type = h.type?.replace(/^request\./, "").replace(/-/g, "_");
      if (type === "revision_requested" && typeof h.details?.submissionNumber === "number" && h.details?.feedback) {
        feedbackBySubmissionNumber.set(h.details.submissionNumber, h.details.feedback);
      }
    }
  }

  const rawSubmissions = Array.isArray(raw.submissions) ? raw.submissions : [];
  const submissions: SubmissionVersionRecord[] = rawSubmissions.map((s: any) => {
    const sFiles: Record<string, AttachedFile[]> = {};
    if (s.files) {
      for (const [k, v] of Object.entries(s.files)) {
        if (Array.isArray(v)) {
          sFiles[k] = v.map((f: any) => ({
            id: f.id || f._id || crypto.randomUUID(),
            name: f.name || f.originalName || f.filename || "file",
            originalName: f.originalName || f.filename || f.name || "file",
            size: f.size || 0,
            mimeType: f.mimeType || "application/octet-stream",
            uploadedAt: f.uploadedAt || f.createdAt || new Date().toISOString(),
            url: f.url || "",
          }));
        }
      }
    }
    return {
      id: s.id || s._id || crypto.randomUUID(),
      number: s.number ?? 1,
      submittedAt: s.submittedAt || new Date().toISOString(),
      changedFieldIds: Array.isArray(s.changedFieldIds) ? s.changedFieldIds : [],
      fieldValues: s.fieldValues || {},
      files: sFiles,
    };
  });

  const previousSubmissions: SubmissionSnapshot[] = raw.previousSubmissions || submissions.slice(0, -1).map((s) => ({
    id: s.id,
    number: s.number,
    submittedAt: s.submittedAt,
    reviewedAt: s.submittedAt,
    fieldValues: s.fieldValues,
    uploads: s.files,
    itemReviews: {},
    feedback: feedbackBySubmissionNumber.get(s.number) || undefined,
  }));

  const decision = raw.decision || (raw.rejectionReason || raw.decidedAt ? {
    rejectionReason: raw.rejectionReason || null,
    decidedAt: raw.decidedAt || null,
    decidedBy: null,
  } : null);

  return {
    id: raw.id || raw._id,
    code,
    title: raw.title,
    categoryId: catId,
    categoryName: catName,
    categorySlug: raw.category?.slug || raw.categorySlug,
    category: raw.category,
    formVersion: raw.formVersion ?? raw.categoryFormVersion ?? 1,
    formSnapshot: raw.form?.fields || raw.formSnapshot || [],
    residentId,
    resident: raw.resident || raw.residentSnapshot,
    property: raw.property || {
      address: fieldValues.propertyAddress || null,
      lotNo: fieldValues.lotNo || null,
    },
    status: raw.status || "submitted",
    assignedReviewerId: raw.assignedReviewerId || raw.assignedReviewer?.id || null,
    assignmentVersion: raw.assignmentVersion ?? 0,
    workflowVersion: raw.workflowVersion ?? 1,
    mediaRevision: raw.mediaRevision ?? 0,
    activeReviewId: raw.activeReviewId || review?.id || null,
    review,
    submissions,
    revision: raw.revision || null,
    decision,
    draftRevision: raw.draftRevision,
    currentStep: raw.currentStep,
    fieldValues,
    uploads,
    itemReviews,
    fileItemReviews,
    revisions: raw.revisions || [],
    previousSubmissions,
    hoaApproved: !!(raw.hoaConfirmed ?? raw.hoaApproved),
    hoaConfirmedAt: raw.hoaConfirmedAt || raw.createdAt || new Date().toISOString(),
    submittedAt: raw.submittedAt || raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || new Date().toISOString(),
    decidedAt: decision?.decidedAt || raw.decidedAt,
    completedAt: raw.completedAt || raw.completion?.completedAt,
    withdrawnAt: raw.withdrawnAt || raw.withdrawal?.withdrawnAt,
    withdrawnFrom: raw.withdrawnFrom || raw.withdrawal?.withdrawnFrom || withdrawnFromHistory(raw.history),
    // The current round's general feedback lives under `revision.feedback`,
    // not a top-level `feedback` key on the real response.
    feedback: raw.revision?.feedback || raw.feedback || undefined,
    rejectionReason: decision?.rejectionReason || raw.rejectionReason,
    deposit: raw.deposit || {
      required: !!raw.depositRequired,
      amount: raw.depositAmount != null ? String(raw.depositAmount) : null,
      amountMinor: raw.depositAmountMinor,
      status: raw.depositReceived ? "received" : raw.depositRequired ? "pending" : "not_required",
      confirmed: raw.depositRequired !== undefined,
      receipt: raw.depositReceipt,
      receivedAt: raw.depositReceivedAt,
    },
    completion: raw.completion || (raw.completedAt || raw.approvalLetter ? {
      completedAt: raw.completedAt || null,
      completedBy: raw.completedBy || null,
      finalApprovalLetter: raw.approvalLetter || null,
      email: raw.letterEmail ? {
        status: (raw.letterEmail.status || "SENT").toUpperCase() as EmailDeliveryStatus,
        attemptCount: 1,
        retryCycle: 0,
        sentAt: raw.letterEmail.at || raw.letterEmail.sentAt,
      } : null,
    } : null),
    withdrawal: raw.withdrawal || (raw.withdrawnAt ? {
      withdrawnAt: raw.withdrawnAt,
      withdrawnBy: raw.withdrawnBy || null,
      withdrawnFrom: raw.withdrawnFrom || null,
      residentContactAcknowledged: true,
    } : null),
    refund: normalizeRefund(raw.refund) || (raw.refundStatus || raw.refundOutcome ? {
      outcome: raw.refundOutcome || raw.refundStatus,
      refundDate: raw.refundDate || undefined,
      displayValue: raw.refundDisplayValue || (raw.refundOutcome === "no_refund" ? "-" : raw.refundDate),
      explanation: raw.refundExplanation || (raw.refundOutcome === "no_refund" ? "A No Refund decision was recorded." : undefined),
      recordedBy: raw.refundRecordedBy || "Staff",
      recordedAt: raw.refundRecordedAt,
      date: raw.refundDate || undefined,
      correctionReason: raw.refundCorrectionReason,
      proof: raw.refundProof,
    } : null),
    approvalLetter: raw.approvalLetter || raw.completion?.finalApprovalLetter,
    letterEmail: raw.letterEmail || raw.completion?.email ? {
      status: (raw.completion?.email?.status || raw.letterEmail?.status || "sent") as any,
      at: raw.completion?.email?.sentAt || raw.letterEmail?.at || raw.completedAt || new Date().toISOString(),
      sentAt: raw.completion?.email?.sentAt,
    } : undefined,
    history: Array.isArray(raw.history) ? raw.history.map((h: any) => ({
      id: h.id || h._id || crypto.randomUUID(),
      // The backend's event slugs are hyphenated (e.g. "request.review-started"),
      // but HistoryEventType/EVENT_CONFIG use underscores ("review_started") —
      // without this replace, hyphenated types (review-started, item-accepted,
      // item-flagged, revision-requested) never match EVENT_CONFIG and fall
      // back to the raw slug as the displayed label.
      type: (h.type?.replace(/^request\./, "").replace(/-/g, "_") || "submitted") as HistoryEventType,
      actor: typeof h.actor === "string" ? { name: h.actor, role: "reviewer" as const } : {
        name: h.actor?.displayName || h.actor?.name || "User",
        role: ((): ActorRole => {
          // The backend sends upper-case roles (REVIEWER, RESIDENT, SUPER_ADMIN).
          const r = String(h.actor?.role || "").toLowerCase();
          return r === "super_admin" || r === "admin" ? "super_admin" : r === "reviewer" ? "reviewer" : r === "resident" ? "resident" : "system";
        })(),
      },
      message: h.message || "",
      createdAt: h.occurredAt || h.createdAt || new Date().toISOString(),
      assignment: h.details?.assignment || h.assignment,
      staffOnly: !!(h.details?.staffOnly || h.staffOnly),
      flaggedItems: Array.isArray(h.details?.flaggedItems) ? h.details.flaggedItems : undefined,
      details: h.details && typeof h.details === "object" ? h.details : undefined,
      submissionNumber: typeof h.details?.submissionNumber === "number" ? h.details.submissionNumber : undefined,
    })) : (Array.isArray(raw.activity) ? raw.activity.map((a: any) => ({
      id: a.id || crypto.randomUUID(),
      type: a.type || "updated",
      actor: { name: a.actor || "User", role: "reviewer" as const },
      message: a.message || "",
      createdAt: a.createdAt || new Date().toISOString(),
    })) : []),
  };
}

export interface ReviewerRequestsQueryParams {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
  submittedFrom?: string;
  submittedTo?: string;
  categoryId?: string;
  categoryStatus?: string;
  assignedReviewerId?: string;
  depositStatus?: string;
  refundOutcome?: string;
}

export interface PaginatedReviewerRequestsResponse {
  requests: RequestRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

function cleanReviewerParams(params?: ReviewerRequestsQueryParams): Record<string, any> {
  const clean: Record<string, any> = {};
  if (!params) return clean;
  if (params.page) clean.page = params.page;
  if (params.limit) clean.limit = params.limit;
  if (params.search && params.search.trim()) clean.search = params.search.trim();
  if (params.status && params.status !== "all") clean.status = params.status;
  if (params.submittedFrom) clean.submittedFrom = params.submittedFrom;
  if (params.submittedTo) clean.submittedTo = params.submittedTo;
  if (params.categoryId && params.categoryId !== "all") clean.categoryId = params.categoryId;
  if (params.categoryStatus && params.categoryStatus !== "all") clean.categoryStatus = params.categoryStatus;
  if (params.assignedReviewerId && params.assignedReviewerId !== "all") clean.assignedReviewerId = params.assignedReviewerId;
  if (params.depositStatus && params.depositStatus !== "all") clean.depositStatus = params.depositStatus;
  if (params.refundOutcome && params.refundOutcome !== "all") clean.refundOutcome = params.refundOutcome;
  return clean;
}

export async function getRequestsPage(params?: ReviewerRequestsQueryParams): Promise<PaginatedReviewerRequestsResponse> {
  const cleanParams = cleanReviewerParams(params);
  const { data } = await axiosInstance.get("/reviewer/requests", { params: cleanParams });
  const list = data?.data?.requests ?? data?.requests ?? [];
  const records = list.map(toReviewerRequestRecord);
  return {
    requests: records,
    pagination: data?.pagination ?? {
      page: params?.page ?? 1,
      limit: params?.limit ?? 20,
      total: list.length,
      totalPages: Math.ceil(list.length / (params?.limit ?? 20)) || 1,
    },
  };
}

export async function getRequests(params?: ReviewerRequestsQueryParams): Promise<RequestRecord[]> {
  const cleanParams = cleanReviewerParams(params);
  const { data } = await axiosInstance.get("/reviewer/requests", { params: cleanParams });
  const list = data?.data?.requests ?? data?.requests ?? [];
  return list.map(toReviewerRequestRecord);
}

export async function getIncomingRequestsPage(params?: {
  search?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedReviewerRequestsResponse> {
  const cleanParams: Record<string, any> = {};
  if (params?.page) cleanParams.page = params.page;
  if (params?.limit) cleanParams.limit = params.limit;
  if (params?.search && params.search.trim()) cleanParams.search = params.search.trim();

  const { data } = await axiosInstance.get("/reviewer/requests/incoming", { params: cleanParams });
  const list = data?.data?.requests ?? data?.requests ?? [];
  const records = list.map(toReviewerRequestRecord);
  return {
    requests: records,
    pagination: data?.pagination ?? {
      page: params?.page ?? 1,
      limit: params?.limit ?? 20,
      total: list.length,
      totalPages: Math.ceil(list.length / (params?.limit ?? 20)) || 1,
    },
  };
}

export async function getIncomingRequests(params?: {
  search?: string;
  page?: number;
  limit?: number;
}): Promise<RequestRecord[]> {
  const { data } = await axiosInstance.get("/reviewer/requests/incoming", { params });
  const list = data?.data?.requests ?? data?.requests ?? [];
  return list.map(toReviewerRequestRecord);
}

export async function getRequestById(id: string): Promise<RequestRecord> {
  const { data } = await axiosInstance.get(`/reviewer/requests/${id}`);
  const req = data?.data?.request ?? data?.request ?? data?.data;
  if (!req) throw new Error("Request not found");
  return toReviewerRequestRecord(req);
}

export async function assignReviewerRequest({
  requestId,
  reviewerId,
  expectedAssignmentVersion,
}: {
  requestId: string;
  reviewerId: string;
  expectedAssignmentVersion?: number;
}): Promise<RequestRecord> {
  const { data } = await axiosInstance.patch(`/reviewer/requests/${requestId}/assignment`, {
    reviewerId,
    expectedAssignmentVersion: expectedAssignmentVersion ?? 0,
  });
  return toReviewerRequestRecord(data.data.request);
}

/** Get a fresh short-lived (10 minute) read-only SAS URL for one submitted file. Never persist it. */
export async function getReviewerFileDownloadUrl(requestId: string, fileId: string): Promise<{ url: string; expiresAt: string }> {
  const { data } = await axiosInstance.get(`/reviewer/requests/${requestId}/files/${fileId}/download`);
  return data.data.download;
}

export async function getResidents(): Promise<Resident[]> {
  return Array.from(knownResidents.values());
}

export async function getCategories(): Promise<Category[]> {
  const { data } = await axiosInstance.get("/categories");
  const list = data?.data?.categories ?? data?.categories ?? [];
  return list.map((c: any) => ({
    id: c.id || c._id,
    name: c.name,
    description: c.description || "",
    status: c.status || "active",
    fields: c.fields || [],
    version: c.currentVersion ?? c.version ?? 1,
    versions: c.versions || [
      {
        version: c.currentVersion ?? c.version ?? 1,
        name: c.name,
        description: c.description || "",
        fields: c.fields || [],
        createdAt: c.createdAt || new Date().toISOString(),
        createdBy: "Super Admin",
        changes: ["Initial form release."],
      },
    ],
    createdAt: c.createdAt || new Date().toISOString(),
    updatedAt: c.updatedAt || new Date().toISOString(),
  }));
}

export async function getReviewers(params?: {
  search?: string;
  page?: number;
  limit?: number;
}): Promise<PublicReviewer[]> {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.set("page", String(params.page));
  if (params?.limit) queryParams.set("limit", String(params.limit));
  if (params?.search?.trim()) queryParams.set("search", params.search.trim());

  const qs = queryParams.toString();
  const url = `/reviewer/reviewers${qs ? `?${qs}` : ""}`;
  const { data } = await axiosInstance.get(url);
  const list = data?.data?.reviewers ?? data?.reviewers ?? [];

  return list.map((r: any) => {
    const firstName = (r.firstName || "").trim();
    const lastName = (r.lastName || "").trim();
    // A reviewer invited without a last name has it stored as a copy of the
    // first name (the backend requires lastName non-empty on create), so
    // skip it here too rather than showing "Riley Riley".
    const hasDistinctLastName = !!lastName && lastName.toLowerCase() !== firstName.toLowerCase();
    const builtName = hasDistinctLastName ? `${firstName} ${lastName}`.trim() : firstName;
    return {
      id: r.id || r._id,
      name: r.name || builtName || "Reviewer",
      email: r.email || "",
      employeeNumber: r.employeeNumber || "",
      designation: r.designation || undefined,
      receiveNewRequests: r.isDefaultReviewer ?? r.receiveNewRequests ?? false,
      inviteStatus: "active" as const,
      loginEnabled: true,
      activeRequestsCount: r.activeRequestsCount,
      createdAt: r.createdAt || new Date().toISOString(),
    };
  });
}
