import { format } from "date-fns";

/** Everything the reviewer can edit before the PDF is generated. Plain strings so the form stays simple. */
export interface LetterDraft {
  date: string;
  reference: string;
  recipientName: string;
  recipientAddress: string;
  subject: string;
  salutation: string;
  /** Paragraphs separated by a blank line. */
  body: string;
  /** One condition per line. */
  conditions: string;
  closing: string;
  signatoryName: string;
  signatoryTitle: string;
  /** Optional "cc:" line. */
  cc: string;
}

function money(v: number | string | null | undefined) {
  return `$${Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function longDate(value?: string | Date | null) {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? "" : format(d, "MMMM d, yyyy");
}

/** Builds the starting letter from the request, resident and signed-in reviewer. All of it stays editable. */
export function buildDefaultLetter(request: RequestRecord, reviewerName: string): LetterDraft {
  const resident = request.resident;
  const residentName =
    resident?.displayName?.trim() ||
    [resident?.firstName, resident?.lastName].filter(Boolean).join(" ").trim() ||
    "Resident";
  const address = request.property?.address || (request.fieldValues?.propertyAddress as string | undefined) || "";
  const lot = request.property?.lotNo || (request.fieldValues?.lotNo as string | undefined) || "";
  const where = [address, lot ? `Lot ${lot}` : ""].filter(Boolean).join(", ");
  const category = request.categoryName || "architectural";
  const submitted = longDate(request.submittedAt);

  const conditions: string[] = [
    "Work must be carried out as described in the approved submission. Any change to the scope, materials or colors requires a new submission to the Board.",
    "All work must comply with applicable codes, permits and community guidelines, and be completed within a reasonable time.",
  ];
  if (request.deposit?.required === true) {
    conditions.push(
      `A deposit${request.deposit.amount != null && request.deposit.amount !== "" ? ` of ${money(request.deposit.amount)}` : ""} is required for this project. It is collected and refunded outside the portal; your reviewer will confirm receipt.`
    );
  }

  return {
    date: longDate(new Date()),
    reference: request.code,
    recipientName: residentName,
    recipientAddress: where,
    subject: `Approval of your ${category} request (${request.code})`,
    salutation: `Dear ${residentName},`,
    body:
      `The Architectural Review Board of The Club at Ibis has reviewed your ${category} request, ${request.code}` +
      `${submitted ? `, submitted on ${submitted}` : ""}${where ? ` for the property at ${where}` : ""}.\n\n` +
      `We are pleased to inform you that your request has been approved.\n\n` +
      `This approval applies to the plans, materials and scope of work exactly as submitted. Please keep this letter for your records.`,
    conditions: conditions.join("\n"),
    closing: "Sincerely,",
    signatoryName: reviewerName,
    signatoryTitle: "Reviewer, Architectural Review Board",
    cc: "",
  };
}

/** The file name used for the uploaded PDF. */
export function letterFileName(request: RequestRecord) {
  return `${request.code}-approval-letter.pdf`;
}
