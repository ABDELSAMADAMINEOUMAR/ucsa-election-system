import { z } from "zod";

const password = z
  .string()
  .min(12)
  .max(128)
  .refine(
    (value) => /[A-Za-z]/.test(value) && /\d/.test(value),
    "Use a letter and a number.",
  );

export const registrationSchema = z
  .object({
    registrationNumber: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9/-]{3,40}$/),
    email: z
      .email()
      .trim()
      .max(254)
      .transform((value) => value.toLowerCase()),
    password,
  })
  .strict();

export const loginSchema = z
  .object({
    email: z
      .email()
      .trim()
      .max(254)
      .transform((value) => value.toLowerCase()),
    password: z.string().min(1).max(128),
  })
  .strict();

export const verificationRequestSchema = z
  .object({
    registrationNumber: z
      .string()
      .trim()
      .toUpperCase()
      .min(3)
      .max(40)
      .regex(/^[A-Z0-9/-]+$/),
  })
  .strict();

export const reviewSchema = z
  .object({
    decision: z.enum(["verified", "rejected", "revoked"]),
    reason: z.string().trim().max(1000).default(""),
  })
  .strict()
  .refine(
    ({ decision, reason }) =>
      !["rejected", "revoked"].includes(decision) || reason.length >= 3,
    { path: ["reason"], message: "Provide a reason for this decision." },
  );

export const candidateReviewSchema = z
  .object({
    decision: z.enum(["approved", "rejected"]),
    reason: z.string().trim().max(1000).default(""),
  })
  .strict()
  .refine(
    ({ decision, reason }) => decision !== "rejected" || reason.length >= 3,
    { path: ["reason"], message: "Provide a reason for rejection." },
  );

export const candidateSchema = z
  .object({
    electionId: z.uuid(),
    officeId: z.uuid(),
    biography: z.string().trim().min(30).max(1000),
    manifesto: z.string().trim().min(80).max(5000),
    consent: z.literal(true),
  })
  .strict();

export const rosterSchema = z
  .object({
    records: z
      .array(
        z
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
          })
          .strict(),
      )
      .min(1)
      .max(250),
  })
  .strict()
  .refine(
    ({ records }) =>
      new Set(records.map((record) => record.registrationNumber)).size ===
        records.length &&
      new Set(records.map((record) => record.email)).size === records.length,
    "Records must not contain duplicate registration numbers or emails.",
  );

export const electionEligibilitySchema = z
  .object({
    electionId: z.uuid(),
    userId: z.uuid(),
    decision: z.enum(["verified", "rejected", "revoked"]),
    reason: z.string().trim().max(1000).default(""),
  })
  .strict()
  .refine(
    ({ decision, reason }) =>
      !["rejected", "revoked"].includes(decision) || reason.length >= 3,
    { path: ["reason"], message: "Provide a reason for this decision." },
  );

export const secureElectionSchema = z
  .object({
    title: z.string().trim().min(5).max(120),
    description: z.string().trim().max(1500).default(""),
    nominationsStart: z.iso.datetime({ local: true, precision: -1 }),
    nominationsEnd: z.iso.datetime({ local: true, precision: -1 }),
    votingStart: z.iso.datetime({ local: true, precision: -1 }),
    votingEnd: z.iso.datetime({ local: true, precision: -1 }),
    offices: z
      .array(z.string().trim().min(2).max(80))
      .min(1)
      .max(20)
      .refine(
        (names) =>
          new Set(names.map((name) => name.toLocaleLowerCase())).size ===
          names.length,
        "Office names must be unique.",
      ),
  })
  .strict()
  .refine(
    (value) =>
      value.nominationsStart < value.nominationsEnd &&
      value.nominationsEnd < value.votingStart &&
      value.votingStart < value.votingEnd,
    {
      path: ["votingStart"],
      message: "Dates must be ordered: nominations, then voting, then close.",
    },
  );

export const committeeMemberSchema = z
  .object({
    userId: z.uuid(),
    role: z.enum([
      "verification_officer",
      "candidate_review_officer",
      "election_administrator",
      "certifying_officer",
    ]),
    electionId: z.uuid().nullable().default(null),
    action: z.enum(["add", "remove"]),
  })
  .strict();
