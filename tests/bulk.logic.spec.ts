import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  csvRows,
  previewRoster,
  csvCell,
  ROSTER_FILE_ROWS,
} from "../src/lib/roster-import";
import {
  bulkDecisionSchema,
  bulkEligibilitySchema,
  importSchema,
  queueSchema,
} from "../src/lib/schemas/bulk";

test("official logo retains its original bytes", () => {
  expect(
    createHash("sha256")
      .update(readFileSync("public/ucsa-logo.png"))
      .digest("hex"),
  ).toBe("92e5c89986db2b9c2ed3ecb9152ebbccb076fe33301775914e2efc00ae540cbb");
});
test("roster CSV supports BOM, quoted commas, escaped quotes and CRLF", () => {
  const result = previewRoster(
    '\uFEFFregistration_number,full_name,email,academic_program\r\n reg-001 ,"Example, ""Student""",EXAMPLE@example.test,Computing\r\n',
  );
  expect(result).toHaveLength(1);
  expect(result[0].errors).toEqual([]);
  expect(result[0].record).toMatchObject({
    registrationNumber: "REG-001",
    email: "example@example.test",
    fullName: 'Example, "Student"',
    status: "approved",
  });
});
test("invalid headers, malformed quotation, excess fields and invalid identity formats are rejected", () => {
  expect(() => previewRoster("name,email\nExample,a@example.test")).toThrow(
    /Required headers/,
  );
  expect(() =>
    previewRoster(
      "registration_number,email,email\nREG-1,a@example.test,b@example.test",
    ),
  ).toThrow(/Duplicate CSV column/);
  expect(() => csvRows('"unfinished')).toThrow(/unclosed/);
  expect(() => csvRows('"x"junk,y')).toThrow(/Unexpected/);
  expect(
    previewRoster("registration_number,email\nREG-1,invalid,extra")[0].errors
      .length,
  ).toBeGreaterThan(0);
  expect(
    previewRoster("registration_number,email\nＲＥＧ-1,a@example.test")[0]
      .errors.length,
  ).toBeGreaterThan(0);
});
test("duplicate registration and emails are detected after safe normalization", () => {
  const rows = previewRoster(
    "registration_number,email\nreg-001,ONE@example.test\n REG-001 ,one@example.test",
  );
  expect(
    rows.every(
      (row) =>
        row.errors.some((error) => error.includes("Duplicate registration")) &&
        row.errors.some((error) => error.includes("Duplicate email")),
    ),
  ).toBe(true);
});
test("roster preview distinguishes existing updates, unchanged records and email conflicts", () => {
  const existing = [
    {
      registration_number: "REG-001",
      verified_email: "one@example.test",
      roster_status: "approved",
      full_name: "One",
      academic_program: "Computing",
    },
  ];
  expect(
    previewRoster(
      "registration_number,email\nREG-001,one@example.test",
      existing,
    )[0].action,
  ).toBe("unchanged");
  const changed = previewRoster(
    "registration_number,email,status\nREG-001,new@example.test,withdrawn",
    existing,
  )[0];
  expect(changed.action).toBe("update");
  expect(changed.warnings[0]).toContain("revoked");
  expect(
    previewRoster(
      "registration_number,email\nREG-002,one@example.test",
      existing,
    )[0].errors[0],
  ).toContain("another registration");
});
test("roster import bounds cover large files and enforce per-batch confirmation/snapshots", () => {
  const text =
    "registration_number,email\n" +
    Array.from(
      { length: ROSTER_FILE_ROWS },
      (_, i) => `REG-${i},student-${i}@example.test`,
    ).join("\n");
  expect(previewRoster(text)).toHaveLength(5000);
  expect(() => previewRoster(text + "\nREG-EXTRA,extra@example.test")).toThrow(
    /5,000/,
  );
  expect(() => csvRows(" ".repeat(1024 * 1024 + 1))).toThrow(/1 MiB/);
  const record = {
    registrationNumber: "REG-1",
    email: "one@example.test",
    expected: null,
  };
  expect(
    importSchema.safeParse({ records: [record], confirmed: true }).success,
  ).toBe(true);
  expect(
    importSchema.safeParse({
      records: [{ registrationNumber: "REG-1", email: "one@example.test" }],
      confirmed: true,
    }).success,
  ).toBe(false);
  expect(
    importSchema.safeParse({ records: [record], confirmed: false }).success,
  ).toBe(false);
  expect(
    importSchema.safeParse({ records: [record, record], confirmed: true })
      .success,
  ).toBe(false);
});
test("bulk decisions require bounded unique IDs, explicit confirmation and rejection reasons", () => {
  const id = "86000000-0000-4000-8000-000000000001";
  const valid = { ids: [id], decision: "verified", confirmed: true };
  expect(bulkDecisionSchema.safeParse(valid).success).toBe(true);
  for (const payload of [
    { ...valid, confirmed: false },
    { ...valid, ids: [id, id] },
    { ...valid, ids: [] },
    { ...valid, role: "committee_chair" },
    { ...valid, decision: "rejected", reason: " " },
  ])
    expect(bulkDecisionSchema.safeParse(payload).success).toBe(false);
  expect(bulkEligibilitySchema.safeParse(valid).success).toBe(false);
  expect(
    bulkEligibilitySchema.safeParse({ ...valid, electionId: id }).success,
  ).toBe(true);
  expect(queueSchema.safeParse({ page: 1, size: 1000 }).success).toBe(false);
});
test("administrative CSV exports escape formulas and embedded quotes", () => {
  expect(csvCell('=HYPERLINK("test")')).toBe('"\'=HYPERLINK(""test"")"');
  expect(csvCell("\t=1+1")).toContain("'");
  expect(csvCell("a,b")).toBe('"a,b"');
});
