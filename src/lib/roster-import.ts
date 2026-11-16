import { z } from "zod";

export const ROSTER_FILE_BYTES = 1024 * 1024;
export const ROSTER_FILE_ROWS = 5000;
export const rosterImportRow = z
  .object({
    registrationNumber: z
      .string()
      .trim()
      .toUpperCase()
      .min(3)
      .max(40)
      .regex(/^[A-Z0-9/-]+$/),
    email: z
      .email()
      .trim()
      .max(254)
      .transform((value) => value.toLowerCase()),
    status: z.enum(["approved", "withdrawn"]).default("approved"),
    fullName: z.string().trim().max(120).optional(),
    academicProgram: z.string().trim().max(120).optional(),
  })
  .strict();
export type ImportRecord = z.infer<typeof rosterImportRow>;
export type RosterEntry = {
  registration_number: string;
  verified_email: string;
  roster_status: string;
  full_name?: string;
  academic_program?: string;
};
export type PreviewRow = {
  line: number;
  record: ImportRecord;
  errors: string[];
  warnings: string[];
  action: "new" | "update" | "unchanged";
};

/** RFC-style quoted CSV fields, including commas, escaped quotes and newlines. */
export function csvRows(text: string): string[][] {
  if (new TextEncoder().encode(text).length > ROSTER_FILE_BYTES)
    throw new Error("CSV files must be 1 MiB or smaller.");
  const result: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let closed = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
        closed = true;
      } else field += c;
    } else if (c === '"') {
      if (field || closed) throw new Error("Malformed CSV quotation.");
      quoted = true;
    } else if (c === "," || c === "\n" || c === "\r") {
      row.push(field.trim());
      field = "";
      closed = false;
      if (c !== ",") {
        if (row.some(Boolean)) result.push(row);
        row = [];
        if (c === "\r" && text[i + 1] === "\n") i++;
        if (result.length > ROSTER_FILE_ROWS + 1)
          throw new Error("A file may contain at most 5,000 records.");
      }
    } else {
      if (closed && c.trim())
        throw new Error("Unexpected text after a quoted CSV field.");
      if (!closed) field += c;
    }
  }
  if (quoted) throw new Error("CSV contains an unclosed quoted field.");
  row.push(field.trim());
  if (row.some(Boolean)) result.push(row);
  if (result.length > ROSTER_FILE_ROWS + 1)
    throw new Error("A file may contain at most 5,000 records.");
  return result;
}

export function previewRoster(
  text: string,
  existing: RosterEntry[] = [],
): PreviewRow[] {
  const matrix = csvRows(text);
  if (matrix.length < 2)
    throw new Error("Include a header and at least one student record.");
  const aliases: Record<string, keyof ImportRecord> = {
    registrationnumber: "registrationNumber",
    studentregistrationnumber: "registrationNumber",
    email: "email",
    universityemail: "email",
    verifiedemail: "email",
    fullname: "fullName",
    academicprogram: "academicProgram",
    program: "academicProgram",
    status: "status",
    rosterstatus: "status",
  };
  const header = matrix[0].map(
    (value) => aliases[value.toLowerCase().replace(/[\s_-]/g, "")],
  );
  if (!header.includes("registrationNumber") || !header.includes("email"))
    throw new Error("Required headers: registration_number and email.");
  if (new Set(header.filter(Boolean)).size !== header.filter(Boolean).length)
    throw new Error("Duplicate CSV column headers.");
  const parsed = matrix.slice(1).map((values, i): PreviewRow => {
    const raw: Record<string, string> = {};
    header.forEach((key, j) => {
      if (key && (values[j] || key !== "status")) raw[key] = values[j] ?? "";
    });
    if (raw.status) raw.status = raw.status.toLowerCase();
    const result = rosterImportRow.safeParse(raw);
    const record = result.success
      ? result.data
      : {
          registrationNumber: (raw.registrationNumber ?? "")
            .trim()
            .toUpperCase(),
          email: (raw.email ?? "").trim().toLowerCase(),
          status: "approved" as const,
          fullName: raw.fullName,
          academicProgram: raw.academicProgram,
        };
    const errors = result.success
      ? []
      : result.error.issues.map(
          (issue) => `${String(issue.path[0])}: invalid value`,
        );
    if (values.length !== header.length)
      errors.push("Column count does not match the header.");
    const current = existing.find(
      (row) => row.registration_number === record.registrationNumber,
    );
    const conflict = existing.some(
      (row) =>
        row.verified_email.toLowerCase() === record.email &&
        row.registration_number !== record.registrationNumber,
    );
    if (conflict)
      errors.push("Email already belongs to another registration number.");
    const action = !current
      ? "new"
      : current.verified_email.toLowerCase() === record.email &&
          current.roster_status === record.status &&
          (record.fullName === undefined ||
            record.fullName === current.full_name) &&
          (record.academicProgram === undefined ||
            record.academicProgram === current.academic_program)
        ? "unchanged"
        : "update";
    return {
      line: i + 2,
      record,
      errors,
      action,
      warnings:
        action === "update"
          ? [
              "Existing roster record will change; identity and eligibility may be revoked by existing correction rules.",
            ]
          : [],
    };
  });
  const registrations = new Map<string, number>();
  const emails = new Map<string, number>();
  for (const row of parsed) {
    registrations.set(
      row.record.registrationNumber,
      (registrations.get(row.record.registrationNumber) ?? 0) + 1,
    );
    emails.set(row.record.email, (emails.get(row.record.email) ?? 0) + 1);
  }
  for (const row of parsed) {
    if ((registrations.get(row.record.registrationNumber) ?? 0) > 1)
      row.errors.push("Duplicate registration number in file.");
    if ((emails.get(row.record.email) ?? 0) > 1)
      row.errors.push("Duplicate email in file.");
  }
  return parsed;
}

/** Prevent spreadsheet formula execution in permitted administrative exports. */
export function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[\s]*[=+@-]/.test(text) || /^[\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}

export function downloadCsv(filename: string, rows: unknown[][]) {
  const url = URL.createObjectURL(
    new Blob([rows.map((row) => row.map(csvCell).join(",")).join("\r\n")], {
      type: "text/csv;charset=utf-8",
    }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
