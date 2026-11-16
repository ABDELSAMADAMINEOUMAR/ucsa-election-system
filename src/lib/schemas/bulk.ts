import { z } from "zod";
import { rosterImportRow } from "@/lib/roster-import";
const ids = z
  .array(z.uuid())
  .min(1)
  .max(100)
  .refine(
    (values) => new Set(values).size === values.length,
    "Duplicate records are not allowed.",
  );
export const bulkDecisionSchema = z
  .object({
    ids,
    decision: z.enum(["verified", "rejected"]),
    reason: z.string().trim().max(1000).default(""),
    confirmed: z.literal(true),
  })
  .strict()
  .refine(
    (value) => value.decision !== "rejected" || value.reason.length >= 3,
    "Rejection requires a reason.",
  );
export const bulkEligibilitySchema = bulkDecisionSchema.safeExtend({
  electionId: z.uuid(),
});
export const queueSchema = z
  .object({
    page: z.number().int().min(1).max(100000).default(1),
    size: z.number().int().min(1).max(100).default(25),
    search: z.string().trim().max(120).default(""),
    status: z
      .enum(["all", "pending", "verified", "rejected", "revoked"])
      .default("pending"),
  })
  .strict();
export const rosterExpectation = z
  .object({
    email: z.string().max(254),
    status: z.enum(["approved", "withdrawn"]),
    fullName: z.string().max(120),
    academicProgram: z.string().max(120),
  })
  .strict()
  .nullable();
export const importSchema = z
  .object({
    records: z
      .array(rosterImportRow.extend({ expected: rosterExpectation }))
      .min(1)
      .max(250),
    confirmed: z.literal(true),
  })
  .strict()
  .refine(
    ({ records }) =>
      new Set(records.map((row) => row.registrationNumber)).size ===
        records.length &&
      new Set(records.map((row) => row.email)).size === records.length,
    "Duplicate roster identifiers.",
  );
