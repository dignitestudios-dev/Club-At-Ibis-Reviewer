import type { LetterDraft } from "./letter-template";

/**
 * Renders the approval letter as a real, text-based PDF (selectable/searchable) on the Club at Ibis letterhead.
 * Built with jsPDF's built-in fonts (Times for the letter, Helvetica for small print) so no font files are needed.
 * jsPDF is imported lazily: it is only downloaded when a reviewer opens the letter composer.
 */

const NAVY: [number, number, number] = [17, 38, 54]; // --primary #112636
const GOLD: [number, number, number] = [160, 135, 74]; // --brand-gold #a0874a
const INK: [number, number, number] = [38, 38, 38];
const MUTED: [number, number, number] = [110, 110, 110];

const PAGE_W = 612; // US Letter, points
const PAGE_H = 792;
const MARGIN_X = 66;
const TOP_FIRST = 56;
const TOP_NEXT = 64;
const BOTTOM = 70;

/** Standard PDF fonts only cover Latin-1: swap typographic punctuation, drop anything else. */
function clean(text: string): string {
  return (text ?? "")
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/…/g, "...")
    .replace(/[   ]/g, " ")
    .replace(/[^\n\x20-\x7E¡-ÿ]/g, "");
}

async function loadImage(src: string): Promise<string | null> {
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function buildLetterPdf(letter: LetterDraft): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const mark = await loadImage("/brand/ibis-mark-navy.png");

  const doc = new jsPDF({ unit: "pt", format: "letter", compress: true });
  const contentW = PAGE_W - MARGIN_X * 2;
  let y = TOP_FIRST;

  const setText = (rgb: [number, number, number]) => doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  const setDraw = (rgb: [number, number, number]) => doc.setDrawColor(rgb[0], rgb[1], rgb[2]);

  /* ----------------------------- letterhead ---------------------------- */
  function firstPageHeader() {
    let textX = MARGIN_X;
    if (mark) {
      doc.addImage(mark, "PNG", MARGIN_X, y - 4, 66, 43.5);
      textX = MARGIN_X + 66 + 16;
    }
    doc.setFont("times", "bold");
    doc.setFontSize(21);
    setText(NAVY);
    doc.text("The Club at Ibis", textX, y + 18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    setText(GOLD);
    doc.text("A R C H I T E C T U R A L   R E V I E W   B O A R D", textX, y + 34);
    y += 56;
    setDraw(GOLD);
    doc.setLineWidth(1.4);
    doc.line(MARGIN_X, y, PAGE_W - MARGIN_X, y);
    doc.setLineWidth(0.4);
    doc.line(MARGIN_X, y + 3, PAGE_W - MARGIN_X, y + 3);
    y += 30;
  }

  function continuationHeader() {
    doc.setFont("times", "bold");
    doc.setFontSize(11);
    setText(NAVY);
    doc.text("The Club at Ibis - Architectural Review Board", MARGIN_X, TOP_NEXT - 20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setText(MUTED);
    doc.text(clean(`Ref. ${letter.reference}`), PAGE_W - MARGIN_X, TOP_NEXT - 20, { align: "right" });
    setDraw(GOLD);
    doc.setLineWidth(0.8);
    doc.line(MARGIN_X, TOP_NEXT - 10, PAGE_W - MARGIN_X, TOP_NEXT - 10);
    y = TOP_NEXT + 14;
  }

  function newPage() {
    doc.addPage();
    continuationHeader();
  }

  function ensure(height: number) {
    if (y + height > PAGE_H - BOTTOM) newPage();
  }

  /* ------------------------------ writers ------------------------------ */
  function paragraph(text: string, opts: { size?: number; gap?: number; bold?: boolean; indent?: number; color?: [number, number, number] } = {}) {
    const size = opts.size ?? 11;
    const indent = opts.indent ?? 0;
    const lineH = size * 1.5;
    doc.setFont("times", opts.bold ? "bold" : "normal");
    doc.setFontSize(size);
    setText(opts.color ?? INK);
    const lines = doc.splitTextToSize(clean(text), contentW - indent) as string[];
    for (const line of lines) {
      ensure(lineH);
      doc.text(line, MARGIN_X + indent, y);
      y += lineH;
    }
    y += opts.gap ?? 8;
  }

  /* ------------------------------- letter ------------------------------ */
  firstPageHeader();

  // Date (left) and reference (right) on one line
  doc.setFont("times", "normal");
  doc.setFontSize(11);
  setText(INK);
  doc.text(clean(letter.date), MARGIN_X, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setText(MUTED);
  doc.text(clean(`Ref. ${letter.reference}`), PAGE_W - MARGIN_X, y, { align: "right" });
  y += 30;

  // Recipient
  paragraph(letter.recipientName, { bold: true, gap: 0 });
  if (letter.recipientAddress.trim()) paragraph(letter.recipientAddress, { gap: 0 });
  y += 14;

  // Subject
  if (letter.subject.trim()) {
    paragraph(`Re: ${letter.subject}`, { bold: true, color: NAVY, gap: 14 });
  }

  if (letter.salutation.trim()) paragraph(letter.salutation, { gap: 10 });

  for (const block of letter.body.split(/\n{2,}/)) {
    const t = block.replace(/\n/g, " ").trim();
    if (t) paragraph(t, { gap: 10 });
  }

  const conditions = letter.conditions
    .split("\n")
    .map((c) => c.trim())
    .filter(Boolean);
  if (conditions.length) {
    y += 2;
    ensure(40);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    setText(GOLD);
    doc.text("CONDITIONS OF APPROVAL", MARGIN_X, y);
    y += 6;
    setDraw(GOLD);
    doc.setLineWidth(0.5);
    doc.line(MARGIN_X, y, MARGIN_X + 150, y);
    y += 16;
    conditions.forEach((c, i) => {
      const size = 11;
      const lineH = size * 1.5;
      doc.setFont("times", "normal");
      doc.setFontSize(size);
      setText(INK);
      const lines = doc.splitTextToSize(clean(c), contentW - 22) as string[];
      ensure(lineH);
      doc.setFont("times", "bold");
      doc.text(`${i + 1}.`, MARGIN_X, y);
      doc.setFont("times", "normal");
      for (const line of lines) {
        ensure(lineH);
        doc.text(line, MARGIN_X + 22, y);
        y += lineH;
      }
      y += 4;
    });
    y += 6;
  }

  // Closing + signature (kept together)
  ensure(110);
  if (letter.closing.trim()) paragraph(letter.closing, { gap: 40 });
  setDraw(INK);
  doc.setLineWidth(0.5);
  doc.line(MARGIN_X, y - 12, MARGIN_X + 190, y - 12);
  paragraph(letter.signatoryName, { bold: true, gap: 0 });
  if (letter.signatoryTitle.trim()) paragraph(letter.signatoryTitle, { size: 10, gap: 0, color: MUTED });
  paragraph("The Club at Ibis - Architectural Review Board", { size: 10, gap: 12, color: MUTED });

  if (letter.cc.trim()) paragraph(`cc: ${letter.cc}`, { size: 10, color: MUTED });

  /* ------------------------------- footers ------------------------------ */
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    setDraw(GOLD);
    doc.setLineWidth(0.6);
    doc.line(MARGIN_X, PAGE_H - 50, PAGE_W - MARGIN_X, PAGE_H - 50);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setText(MUTED);
    doc.text("The Club at Ibis  |  Architectural Review Board", MARGIN_X, PAGE_H - 36);
    doc.text(`Page ${p} of ${total}`, PAGE_W - MARGIN_X, PAGE_H - 36, { align: "right" });
  }

  doc.setProperties({
    title: clean(`Approval letter ${letter.reference}`),
    subject: clean(letter.subject),
    author: "The Club at Ibis - Architectural Review Board",
  });

  return doc.output("blob");
}
