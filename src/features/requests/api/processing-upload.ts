import {
  completeProcessingFileUpload,
  createProcessingFileUploadIntent,
  type ProcessingFilePurpose,
} from "./review.service";
import { putFileToBlob } from "./blob-upload";

/**
 * Uploads a staff document (deposit receipt / final approval letter): intent -> direct blob PUT -> complete.
 *
 * Why this is more than three calls in a row:
 *  - The backend allows only ONE pending upload per request + purpose, and a half-finished attempt stays
 *    pending for up to an hour. A fresh random `clientUploadId` on every try therefore locks the reviewer
 *    out ("PROCESSING_FILE_UPLOAD_PENDING"). The backend treats a repeated `clientUploadId` with identical
 *    file metadata as "resume this upload", so the id is remembered per request + purpose + file.
 *  - `expectedMediaRevision` moves every time an intent is created; a stale value is retried once with the
 *    revision the backend reports.
 */

interface RememberedUpload {
  clientUploadId: string;
  name: string;
  size: number;
  type: string;
}

const storageKey = (requestId: string, purpose: ProcessingFilePurpose) => `ibis.processing-upload.${requestId}.${purpose}`;

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return "upl-" + Math.random().toString(36).slice(2, 11) + "-" + Date.now();
}

function remember(requestId: string, purpose: ProcessingFilePurpose, file: File, mime: string): string {
  const key = storageKey(requestId, purpose);
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const prev = JSON.parse(raw) as RememberedUpload;
      if (prev.name === file.name && prev.size === file.size && prev.type === mime) return prev.clientUploadId;
    }
    const next: RememberedUpload = { clientUploadId: newId(), name: file.name, size: file.size, type: mime };
    localStorage.setItem(key, JSON.stringify(next));
    return next.clientUploadId;
  } catch {
    return newId();
  }
}

function forget(requestId: string, purpose: ProcessingFilePurpose) {
  try {
    localStorage.removeItem(storageKey(requestId, purpose));
  } catch {
    /* ignore */
  }
}

/** The file of the last unfinished attempt, so the UI can tell the reviewer which file to pick to resume. */
export function getUnfinishedUpload(requestId: string, purpose: ProcessingFilePurpose): { name: string; size: number } | null {
  try {
    const raw = localStorage.getItem(storageKey(requestId, purpose));
    if (!raw) return null;
    const prev = JSON.parse(raw) as RememberedUpload;
    return { name: prev.name, size: prev.size };
  } catch {
    return null;
  }
}

function apiCode(err: any): string | undefined {
  return err?.response?.data?.code || err?.code;
}

function currentMediaRevisionFrom(err: any): number | undefined {
  const d = err?.response?.data?.details;
  const v = d?.currentMediaRevision ?? err?.response?.data?.currentMediaRevision;
  return typeof v === "number" ? v : undefined;
}

export class ProcessingUploadError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
  }
}

function friendly(err: any, stage: "intent" | "storage" | "complete"): ProcessingUploadError {
  const code = apiCode(err);
  const serverMessage = err?.response?.data?.message as string | undefined;
  if (code === "PROCESSING_FILE_UPLOAD_PENDING") {
    return new ProcessingUploadError(
      "An earlier upload of this document didn’t finish and is still on hold. Select the same file again to resume it — otherwise it clears itself within about an hour.",
      code
    );
  }
  if (code === "UPLOAD_ATTEMPT_EXPIRED") {
    return new ProcessingUploadError("The earlier upload attempt expired. Please choose the file and upload again.", code);
  }
  if (code === "UPLOAD_NOT_FOUND") {
    return new ProcessingUploadError("The file didn’t reach storage. Please try the upload again.", code);
  }
  if (code === "STALE_MEDIA_REVISION" || code === "STALE_WORKFLOW_VERSION" || err?.response?.status === 409) {
    return new ProcessingUploadError(serverMessage || "The request was updated in another session. Please refresh and try again.", code);
  }
  if (stage === "storage") return new ProcessingUploadError(err?.message || "Upload to storage failed.", code);
  return new ProcessingUploadError(serverMessage || err?.message || "The upload failed. Please try again.", code);
}

export async function uploadProcessingFile({
  request,
  purpose,
  file,
  onProgress,
}: {
  request: Pick<RequestRecord, "id" | "assignmentVersion" | "workflowVersion" | "mediaRevision">;
  purpose: ProcessingFilePurpose;
  file: File;
  onProgress?: (percent: number) => void;
}): Promise<void> {
  const mime = file.type || "application/pdf";
  const clientUploadId = remember(request.id, purpose, file, mime);
  const assignment = request.assignmentVersion ?? 0;
  const workflow = request.workflowVersion ?? 1;

  // 1) Intent (retry once if our media revision is stale)
  let mediaRevision = request.mediaRevision ?? 0;
  let intent: Awaited<ReturnType<typeof createProcessingFileUploadIntent>>;
  try {
    const attempt = (rev: number) =>
      createProcessingFileUploadIntent({
        requestId: request.id,
        expectedAssignmentVersion: assignment,
        expectedWorkflowVersion: workflow,
        expectedMediaRevision: rev,
        purpose,
        clientUploadId,
        originalName: file.name,
        size: file.size,
        declaredMimeType: mime,
      });
    try {
      intent = await attempt(mediaRevision);
    } catch (err: any) {
      const fresh = apiCode(err) === "STALE_MEDIA_REVISION" ? currentMediaRevisionFrom(err) : undefined;
      if (fresh === undefined) throw err;
      mediaRevision = fresh;
      intent = await attempt(fresh);
    }
  } catch (err: any) {
    throw friendly(err, "intent");
  }

  // 2) Direct upload to blob storage. The backend names the headers Azure requires (`x-ms-blob-type`,
  //    `Content-Type`) in `requiredHeaders`; without them Azure rejects the PUT and the upload stays pending.
  //    `upload` is null when this attempt had already finished.
  if (intent.upload) {
    try {
      await putFileToBlob(intent.upload.url, file, intent.upload.requiredHeaders ?? intent.upload.headers ?? {}, onProgress);
    } catch (err: any) {
      throw friendly(err, "storage");
    }
  } else {
    onProgress?.(100);
  }

  // 3) Complete (retry once on a stale media revision)
  try {
    const complete = (rev: number) =>
      completeProcessingFileUpload({
        requestId: request.id,
        fileId: intent.file.id,
        expectedAssignmentVersion: assignment,
        expectedWorkflowVersion: workflow,
        expectedMediaRevision: rev,
      });
    try {
      await complete(intent.mediaRevision ?? mediaRevision);
    } catch (err: any) {
      const fresh = apiCode(err) === "STALE_MEDIA_REVISION" ? currentMediaRevisionFrom(err) : undefined;
      if (fresh === undefined) throw err;
      await complete(fresh);
    }
  } catch (err: any) {
    throw friendly(err, "complete");
  }

  forget(request.id, purpose);
}
