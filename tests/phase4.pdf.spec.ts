import { test, expect } from "@playwright/test";
import { PDFDocument, PDFDict, PDFName } from "pdf-lib";
import { createElectionPdf } from "../src/lib/reports/pdf";

test("PDF summary embeds the official logo and generates a readable page", async () => {
  const bytes = await createElectionPdf("Election Summary", "Synthetic local election", "DRAFT", [
    { heading: "Election information", text: "Synthetic data only · UCSA Phase 4" },
    { text: "Voting is closed; this report is not certified." },
  ]);
  expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe("%PDF-");
  const document = await PDFDocument.load(bytes);
  expect(document.getPageCount()).toBe(1);
  const page = document.getPage(0);
  const xObjects = page.node.Resources()?.lookup(PDFName.of("XObject"), PDFDict);
  expect(xObjects?.asMap().size).toBeGreaterThan(0);
});

test("PDF report paginates long reports and handles an empty-results report", async () => {
  const empty = await createElectionPdf("Certified Results", "Synthetic empty election", "CERTIFIED", [{ text: "No approved candidate records." }]);
  expect((await PDFDocument.load(empty)).getPageCount()).toBeGreaterThan(0);
  const lines = Array.from({ length: 120 }, (_, index) => ({ text: `Synthetic report row ${index + 1} — no voter selection data` }));
  const large = await createElectionPdf("Participation Summary", "Synthetic election", "CLOSED", lines);
  expect((await PDFDocument.load(large)).getPageCount()).toBeGreaterThan(1);
});
