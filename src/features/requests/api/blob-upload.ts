/**
 * Direct browser -> Azure Blob upload utility for staff documents (Deposit Receipt, Final Approval Letter).
 *
 * Must NOT go through the app's axiosInstance: the SAS URL already carries its
 * own authorization in the query string, so no Bearer token should be attached,
 * and axios's global interceptors don't apply to Azure Storage responses.
 *
 * Plain XHR is used to capture progress events for file upload progress indicators.
 */
export function putFileToBlob(
  uploadUrl: string,
  file: File,
  requiredHeaders: Record<string, string>,
  onProgress?: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl, true);
    for (const [key, value] of Object.entries(requiredHeaders)) {
      xhr.setRequestHeader(key, value);
    }

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable || !onProgress) return;
      onProgress(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
      } else {
        reject(new Error(`Upload to storage failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Upload to storage failed (network error)"));
    xhr.onabort = () => reject(new Error("Upload cancelled"));

    xhr.send(file);
  });
}
