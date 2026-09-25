import axiosInstance from "@/lib/axios";

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
    assignmentVersion: raw.assignmentVersion,
    draftRevision: raw.draftRevision,
    currentStep: raw.currentStep,
    fieldValues,
    uploads,
    itemReviews: raw.itemReviews || {},
    revisions: raw.revisions || [],
    previousSubmissions: raw.previousSubmissions || [],
    hoaApproved: !!(raw.hoaConfirmed ?? raw.hoaApproved),
    hoaConfirmedAt: raw.hoaConfirmedAt || raw.createdAt || new Date().toISOString(),
    submittedAt: raw.submittedAt || raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || new Date().toISOString(),
    decidedAt: raw.decidedAt,
    completedAt: raw.completedAt,
    withdrawnAt: raw.withdrawnAt,
    withdrawnFrom: raw.withdrawnFrom,
    feedback: raw.feedback,
    rejectionReason: raw.rejectionReason,
    deposit: raw.deposit || {
      required: !!raw.depositRequired,
      amount: raw.depositAmount,
      status: raw.depositReceived ? "received" : raw.depositRequired ? "pending" : "not_required",
      confirmed: raw.depositRequired !== undefined,
    },
    refund: raw.refund || (raw.refundStatus ? {
      outcome: raw.refundStatus,
      recordedBy: "Staff",
      date: raw.refundDate || new Date().toISOString(),
    } : undefined),
    approvalLetter: raw.approvalLetter,
    letterEmail: raw.letterEmail,
    history: Array.isArray(raw.history) ? raw.history.map((h: any) => ({
      id: h.id || h._id || crypto.randomUUID(),
      type: (h.type?.replace(/^request\./, "") || "submitted") as HistoryEventType,
      actor: typeof h.actor === "string" ? { name: h.actor, role: "reviewer" as const } : {
        name: h.actor?.displayName || h.actor?.name || "User",
        role: (h.actor?.role === "super_admin" || h.actor?.role === "admin" ? "super_admin" : h.actor?.role === "reviewer" ? "reviewer" : h.actor?.role === "resident" ? "resident" : "system") as ActorRole,
      },
      message: h.message || "",
      createdAt: h.occurredAt || h.createdAt || new Date().toISOString(),
      assignment: h.details?.assignment || h.assignment,
      staffOnly: !!(h.details?.staffOnly || h.staffOnly),
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

  return list.map((r: any) => ({
    id: r.id || r._id,
    name: r.name || `${r.firstName || ""} ${r.lastName || ""}`.trim() || "Reviewer",
    email: r.email || "",
    employeeNumber: r.employeeNumber || "",
    designation: r.designation || undefined,
    receiveNewRequests: r.isDefaultReviewer ?? r.receiveNewRequests ?? false,
    inviteStatus: "active" as const,
    loginEnabled: true,
    activeRequestsCount: r.activeRequestsCount,
    createdAt: r.createdAt || new Date().toISOString(),
  }));
}
