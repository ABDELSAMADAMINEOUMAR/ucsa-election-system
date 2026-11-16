import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage, type PDFPageDrawTextOptions } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { randomUUID } from "node:crypto";

export type ReportLine = { heading?: string; text?: string; columns?: string[] };
export async function createElectionPdf(title: string, electionTitle: string, reference: string, lines: ReportLine[]) {
  const doc = await PDFDocument.create(); doc.registerFontkit(fontkit);
  const fontPath = (...parts: string[]) => join(process.cwd(), "src", "lib", "reports", "fonts", ...parts);
  const [regularBytes, boldBytes, arabicBytes] = await Promise.all(["NotoSans-Regular.ttf", "NotoSans-Bold.ttf", "NotoSansArabic-Regular.ttf"].map((name) => readFile(fontPath(name))));
  const font = await doc.embedFont(regularBytes, { subset: true });
  const bold = await doc.embedFont(boldBytes, { subset: true });
  const arabic = await doc.embedFont(arabicBytes, { subset: true });
  const characters = new Set(font.getCharacterSet()); const arabicCharacters = new Set(arabic.getCharacterSet());
  function runs(text: string, preferred: PDFFont) {
    const output: { text: string; font: PDFFont }[] = [];
    for (const character of text.normalize("NFC").replace(/[\u0000-\u001f\u007f]/g, " ")) {
      const point = character.codePointAt(0)!;
      const chosen = characters.has(point) ? preferred : arabicCharacters.has(point) ? arabic : preferred;
      // Preserve unsupported characters explicitly instead of throwing or
      // silently changing a candidate's identity to a replacement glyph.
      const value = characters.has(point) || arabicCharacters.has(point) ? character : `[U+${point.toString(16).toUpperCase()}]`;
      const previous = output.at(-1);
      if (previous?.font === chosen) previous.text += value;
      else output.push({ text: value, font: chosen });
    }
    return output;
  }
  function widthOf(text: string, f: PDFFont, size: number) { return runs(text, f).reduce((sum, run) => sum + run.font.widthOfTextAtSize(run.text, size), 0); }
  function draw(target: PDFPage, text: string, options: PDFPageDrawTextOptions) {
    let x = options.x ?? 0;
    for (const run of runs(text, options.font ?? font)) {
      target.drawText(run.text, { ...options, x, font: run.font });
      x += run.font.widthOfTextAtSize(run.text, options.size ?? 9);
    }
  }
  const bytes = await readFile(join(process.cwd(), "public", "ucsa-logo.png")); const logo = await doc.embedPng(bytes);
  const reportId = `UCSA-RPT-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
  let page: PDFPage; let y = 0;
  function newPage() {
    page = doc.addPage([612, 792]); y = 740;
    page.drawImage(logo, { x: 48, y: 696, width: 48, height: 48 });
    draw(page, "UNILAK CHADIAN STUDENTS ASSOCIATION", { x: 108, y: 724, size: 9, font: bold, color: rgb(0.05, 0.24, 0.52) });
    draw(page, "ELECTION MANAGEMENT SYSTEM", { x: 108, y: 708, size: 8, font, color: rgb(0.35, 0.4, 0.48) });
    page.drawLine({ start: { x: 48, y: 690 }, end: { x: 564, y: 690 }, thickness: 1, color: rgb(0.82, 0.86, 0.91) });
    y = 665;
  }
  function ensure(height: number) { if (y < 66 + height) { newPage(); } }
  function wrap(text: string, f: PDFFont, size: number, width: number) {
    const words = text.replace(/[\r\n]+/g, " ").split(/\s+/); const output: string[] = []; let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (widthOf(next, f, size) <= width) { line = next; continue; }
      if (line) { output.push(line); line = ""; }
      for (const character of word) {
        if (line && widthOf(line + character, f, size) > width) { output.push(line); line = ""; }
        line += character;
      }
    }
    if (line) output.push(line); return output;
  }
  function fit(text: string, f: PDFFont, size: number, width: number) {
    const characters = Array.from(text); if (widthOf(text, f, size) <= width) return text;
    while (characters.length && widthOf(characters.join("") + "…", f, size) > width) characters.pop();
    return characters.join("") + "…";
  }
  newPage(); draw(page!, title, { x: 48, y: y - 2, size: 20, font: bold, color: rgb(0.05, 0.24, 0.52) }); y -= 32;
  for (const row of wrap(electionTitle, bold, 12, 510)) { ensure(18); draw(page!, row, { x: 48, y, size: 12, font: bold }); y -= 18; }
  y -= 2;
  draw(page!, `Report ID: ${reportId}`, { x: 48, y, size: 8, font, color: rgb(0.3, 0.34, 0.4) }); y -= 14;
  draw(page!, `Generated: ${new Date().toISOString()} · State: ${reference}`, { x: 48, y, size: 8, font, color: rgb(0.3, 0.34, 0.4) }); y -= 25;
  for (const item of lines) {
    if (item.columns) {
      ensure(25); const headings = item.columns[0] === "Candidate"; const f = headings ? bold : font; const size = 8;
      const positions = [48, 340, 405, 470]; const widths = [280, 55, 55, 94];
      item.columns.slice(0, 4).forEach((cell, index) => draw(page!, fit(cell, f, size, widths[index]), { x: positions[index], y, size, font: f, color: headings ? rgb(0.05, 0.24, 0.52) : rgb(0.12, 0.16, 0.22) }));
      y -= 9; page!.drawLine({ start: { x: 48, y }, end: { x: 564, y }, thickness: headings ? 1 : 0.4, color: rgb(0.82, 0.86, 0.91) }); y -= 11;
      continue;
    }
    const f = item.heading ? bold : font; const size = item.heading ? 11 : 9; const wrapped = wrap(item.text ?? "", f, size, 510);
    ensure(item.heading ? 35 : 14);
    if (item.heading) { y -= 4; draw(page!, item.heading, { x: 48, y, size: 11, font: bold, color: rgb(0.05, 0.24, 0.52) }); y -= 17; }
    for (const row of wrapped) { ensure(13); draw(page!, row, { x: item.heading ? 48 : 58, y, size, font: f }); y -= 13; }
    y -= 5;
  }
  const pages = doc.getPages();
  for (let index = 0; index < pages.length; index += 1) {
    const current = pages[index]; current.drawLine({ start: { x: 48, y: 48 }, end: { x: 564, y: 48 }, thickness: 0.7, color: rgb(0.82, 0.86, 0.91) });
    draw(current, `${reportId} · Confidential when not publicly published`, { x: 48, y: 34, size: 7, font, color: rgb(0.38, 0.42, 0.48) });
    draw(current, `Page ${index + 1} of ${pages.length}`, { x: 500, y: 34, size: 7, font, color: rgb(0.38, 0.42, 0.48) });
  }
  return doc.save();
}
