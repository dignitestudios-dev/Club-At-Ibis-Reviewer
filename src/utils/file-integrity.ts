type IntegrityResult = { valid: boolean; error?: string };

/**
 * Validates whether a file is intact and can be properly parsed/opened.
 * Catches empty, truncated or damaged PDFs, images and Word (.docx) files before they are uploaded,
 * so every accepted file can later be previewed and appended to system-generated PDFs.
 */
export async function validateFileIntegrity(file: File): Promise<IntegrityResult> {
  const name = file.name.toLowerCase();
  const ext = name.substring(name.lastIndexOf("."));

  if (file.size === 0) {
    return { valid: false, error: `"${file.name}" is completely empty (0 bytes) and cannot be uploaded.` };
  }

  if (ext === ".pdf" || file.type === "application/pdf") return validatePdfIntegrity(file);
  if (ext === ".png" || file.type === "image/png") return validateImageIntegrity(file, "png");
  if (ext === ".jpg" || ext === ".jpeg" || file.type === "image/jpeg") return validateImageIntegrity(file, "jpeg");
  if (file.type.startsWith("image/")) return validateImageIntegrity(file);
  if (ext === ".docx") return validateDocxIntegrity(file);

  return { valid: true };
}

const corrupted = (file: File, detail = "is corrupted or unreadable. Please check the file and try uploading again.") => ({
  valid: false,
  error: `"${file.name}" ${detail}`,
});

async function readBytes(file: File, start: number, end: number): Promise<Uint8Array> {
  return new Uint8Array(await file.slice(Math.max(0, start), Math.min(file.size, end)).arrayBuffer());
}

function indexOfAscii(bytes: Uint8Array, text: string, from = 0): number {
  outer: for (let i = from; i <= bytes.length - text.length; i++) {
    for (let j = 0; j < text.length; j++) {
      if (bytes[i + j] !== text.charCodeAt(j)) continue outer;
    }
    return i;
  }
  return -1;
}

function lastIndexOfAscii(bytes: Uint8Array, text: string): number {
  outer: for (let i = bytes.length - text.length; i >= 0; i--) {
    for (let j = 0; j < text.length; j++) {
      if (bytes[i + j] !== text.charCodeAt(j)) continue outer;
    }
    return i;
  }
  return -1;
}

async function validatePdfIntegrity(file: File): Promise<IntegrityResult> {
  try {
    // A real PDF starts with "%PDF-" and, unless truncated, ends with "%%EOF" (trailing whitespace/garbage is tolerated).
    const head = await readBytes(file, 0, 1024);
    if (indexOfAscii(head, "%PDF-") === -1) {
      return corrupted(file, "is not a valid PDF document.");
    }
    const tail = await readBytes(file, file.size - 2048, file.size);
    if (lastIndexOfAscii(tail, "%%EOF") === -1) {
      return corrupted(file, "is incomplete or damaged (the end of the PDF is missing).");
    }

    const arrayBuffer = await file.arrayBuffer();

    // Dynamic import so pdf-lib is loaded on-demand
    const { PDFDocument } = await import("pdf-lib");

    // pdf-lib logs noisy warnings while parsing damaged files
    const origWarn = console.warn;
    console.warn = () => {};

    let doc;
    try {
      // throwOnInvalidObject makes pdf-lib fail on damaged objects instead of silently skipping them.
      doc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true, throwOnInvalidObject: true });
    } finally {
      console.warn = origWarn;
    }

    if (doc.isEncrypted) {
      return corrupted(file, "is password-protected or encrypted and cannot be processed. Please upload an unprotected copy.");
    }

    // Resolve every page so a broken page tree is caught now, not when the PDF is previewed or merged later.
    const pages = doc.getPages();
    if (pages.length < 1) {
      return corrupted(file, "appears to be empty or contains no readable pages.");
    }
    for (const page of pages) {
      const { width, height } = page.getSize();
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return corrupted(file, "contains a page with invalid dimensions.");
      }
    }

    return { valid: true };
  } catch {
    return corrupted(file);
  }
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
// Length (0) + "IEND" + CRC of an empty IEND chunk.
const PNG_IEND = [0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82];

async function validateImageStructure(file: File, kind: "png" | "jpeg"): Promise<boolean> {
  if (kind === "png") {
    const head = await readBytes(file, 0, PNG_SIGNATURE.length);
    if (head.length < PNG_SIGNATURE.length || !PNG_SIGNATURE.every((b, i) => head[i] === b)) return false;
    // Tolerate trailing padding after IEND by scanning the last 64 bytes.
    const tail = await readBytes(file, file.size - 64, file.size);
    for (let i = tail.length - PNG_IEND.length; i >= 0; i--) {
      if (PNG_IEND.every((b, j) => tail[i + j] === b)) return true;
    }
    return false;
  }
  const head = await readBytes(file, 0, 3);
  if (head.length < 3 || head[0] !== 0xff || head[1] !== 0xd8 || head[2] !== 0xff) return false;
  // JPEG data ends with the EOI marker (FF D9); tolerate trailing padding.
  const tail = await readBytes(file, file.size - 64, file.size);
  for (let i = tail.length - 2; i >= 0; i--) {
    if (tail[i] === 0xff && tail[i + 1] === 0xd9) return true;
  }
  return false;
}

async function validateImageIntegrity(file: File, kind?: "png" | "jpeg"): Promise<IntegrityResult> {
  if (typeof window === "undefined") return { valid: true };

  try {
    // Truncated or mislabelled images often still decode partially in a browser, so check the file structure first.
    if (kind && !(await validateImageStructure(file, kind))) {
      return corrupted(file, "is corrupted, incomplete or not a valid image. Please select a valid file.");
    }
  } catch {
    return corrupted(file, "is corrupted or is not a valid image. Please select a valid file.");
  }

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      if (img.naturalWidth === 0 || img.naturalHeight === 0) {
        resolve(corrupted(file, "is corrupted and has invalid image dimensions."));
      } else {
        resolve({ valid: true });
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(corrupted(file, "is corrupted or is not a valid image. Please select a valid file."));
    };

    img.src = objectUrl;
  });
}

/**
 * A .docx is a zip archive. Rather than trusting the "PK" header alone, read the zip's central directory
 * (which sits at the end of the file, so a truncated upload has none) and require the parts every Word
 * document contains.
 */
async function validateDocxIntegrity(file: File): Promise<IntegrityResult> {
  const notDocx = "is corrupted or not a valid Word (.docx) document.";
  try {
    if (file.size < 22) return corrupted(file, notDocx);

    const head = await readBytes(file, 0, 4);
    if (!(head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04)) {
      return corrupted(file, notDocx);
    }

    // End-of-central-directory record: signature 0x06054b50, within the last 22 + 65535 (max comment) bytes.
    const tailStart = Math.max(0, file.size - (22 + 65535));
    const tail = await readBytes(file, tailStart, file.size);
    const tailView = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
    let eocd = -1;
    for (let i = tail.length - 22; i >= 0; i--) {
      if (tailView.getUint32(i, true) === 0x06054b50) {
        eocd = i;
        break;
      }
    }
    if (eocd === -1) return corrupted(file, "is incomplete or damaged (the end of the Word document is missing).");

    const entryCount = tailView.getUint16(eocd + 10, true);
    const cdSize = tailView.getUint32(eocd + 12, true);
    const cdOffset = tailView.getUint32(eocd + 16, true);
    if (entryCount === 0 || cdOffset + cdSize > file.size) {
      return corrupted(file, notDocx);
    }

    const cd = await readBytes(file, cdOffset, cdOffset + cdSize);
    const cdView = new DataView(cd.buffer, cd.byteOffset, cd.byteLength);
    const decoder = new TextDecoder();
    const names = new Set<string>();
    let pos = 0;
    for (let n = 0; n < entryCount; n++) {
      if (pos + 46 > cd.length || cdView.getUint32(pos, true) !== 0x02014b50) return corrupted(file, notDocx);
      const nameLen = cdView.getUint16(pos + 28, true);
      const extraLen = cdView.getUint16(pos + 30, true);
      const commentLen = cdView.getUint16(pos + 32, true);
      if (pos + 46 + nameLen > cd.length) return corrupted(file, notDocx);
      names.add(decoder.decode(cd.subarray(pos + 46, pos + 46 + nameLen)));
      pos += 46 + nameLen + extraLen + commentLen;
    }

    if (!names.has("[Content_Types].xml") || !names.has("word/document.xml")) {
      return corrupted(file, notDocx);
    }
    return { valid: true };
  } catch {
    return corrupted(file, notDocx);
  }
}
