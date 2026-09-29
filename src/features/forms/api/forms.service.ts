import axiosInstance from "@/lib/axios";

/** The actual shape of `createdBy` on a category/version (`{id, role, displayName}`) — not the plain string the shared `CategoryVersion` type assumes, which nothing here actually returns. */
export interface VersionActor {
  id: string | null;
  role: string;
  displayName: string;
}

export interface CategoryVersionDetail {
  id: string;
  categoryId: string;
  version: number;
  name: string;
  description: string;
  fields: CategoryField[];
  note: string | null;
  changes: string[];
  changeSummaries: string[];
  restoredFromVersion: number | null;
  createdBy: VersionActor;
  createdAt: string;
}

export interface CategoryVersionsResult {
  category: {
    id: string;
    name: string;
    description: string;
    status: CategoryStatus;
    currentVersion: number;
    fields?: CategoryField[];
  };
  versions: CategoryVersionDetail[];
}

function toActor(raw: any): VersionActor {
  return {
    id: raw?.id ?? null,
    role: raw?.role ?? "SUPER_ADMIN",
    displayName: raw?.displayName || "Super Admin",
  };
}

function toField(f: any): CategoryField {
  return {
    id: f.id || f._id || "",
    label: f.label ?? "",
    type: f.type,
    required: !!f.required,
    helpText: f.helpText ?? undefined,
    options: f.options ? [...f.options] : undefined,
    accept: f.accept ? [...f.accept] : undefined,
    multiple: f.multiple !== undefined ? !!f.multiple : undefined,
    order: typeof f.order === "number" ? f.order : 0,
  };
}

function toVersion(raw: any): CategoryVersionDetail {
  return {
    id: raw.id || raw._id || "",
    categoryId: raw.categoryId || "",
    version: raw.version,
    name: raw.name ?? "",
    description: raw.description ?? "",
    fields: Array.isArray(raw.fields) ? raw.fields.map(toField) : [],
    note: raw.note ?? null,
    changes: Array.isArray(raw.changes) ? raw.changes : [],
    changeSummaries: Array.isArray(raw.changeSummaries) ? raw.changeSummaries : [],
    restoredFromVersion: raw.restoredFromVersion ?? null,
    createdBy: toActor(raw.createdBy),
    createdAt: raw.createdAt || new Date().toISOString(),
  };
}

/**
 * The full, real version history for a category — GET /reviewer/categories/:id/versions.
 * `useCategories()`'s `category.versions` is NOT this: the plain category list
 * endpoint never returns real version history, so that field only ever holds
 * a single fabricated "Initial form release." entry credited to "Super Admin".
 */
export async function getCategoryVersions(categoryId: string): Promise<CategoryVersionsResult> {
  const { data } = await axiosInstance.get(`/reviewer/categories/${categoryId}/versions`);
  const body = data?.data ?? {};
  const rawCategory = body.category ?? {};
  return {
    category: {
      id: rawCategory.id || rawCategory._id || categoryId,
      name: rawCategory.name ?? "",
      description: rawCategory.description ?? "",
      status: rawCategory.status ?? "active",
      currentVersion: rawCategory.currentVersion ?? 1,
      fields: Array.isArray(rawCategory.fields) ? rawCategory.fields.map(toField) : undefined,
    },
    versions: Array.isArray(body.versions) ? body.versions.map(toVersion) : [],
  };
}
