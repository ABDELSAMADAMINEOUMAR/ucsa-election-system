import { test, expect } from "@playwright/test";
import {
  applicationSchema,
  electionSchema,
  signInSchema,
} from "../src/lib/schemas";
import {
  initialElection,
  initialVoters,
  publishedResults,
} from "../src/demo/data";
import { matches, percent } from "../src/lib/utils";
import { registrationSchema, loginSchema, verificationRequestSchema, rosterSchema, secureElectionSchema, candidateReviewSchema, reviewSchema } from "../src/lib/schemas/account";
import { isPublicRegistrationEnabled } from "../src/lib/registration-policy";
import { isSyntheticVotingEnabled } from "../src/lib/voting-policy";

test("synthetic ballot submission requires both explicit demo mode and opt-in", () => {
  for (const mode of [undefined, "production", "management", "real"]) expect(isSyntheticVotingEnabled(mode, "true")).toBe(false);
  for (const enabled of [undefined, "false", "TRUE", "1"]) expect(isSyntheticVotingEnabled("demo", enabled)).toBe(false);
  expect(isSyntheticVotingEnabled("demo", "true")).toBe(true);
});

test("public registration is closed by default in production and opt-in only", () => {
  const previous = process.env.UCSA_PUBLIC_REGISTRATION_ENABLED;
  delete process.env.UCSA_PUBLIC_REGISTRATION_ENABLED;
  try {
  expect(isPublicRegistrationEnabled("production", undefined)).toBe(false);
  expect(isPublicRegistrationEnabled("production", "false")).toBe(false);
  expect(isPublicRegistrationEnabled("production", "true")).toBe(true);
  expect(isPublicRegistrationEnabled("development", undefined)).toBe(true);
  } finally {
    if (previous === undefined) delete process.env.UCSA_PUBLIC_REGISTRATION_ENABLED;
    else process.env.UCSA_PUBLIC_REGISTRATION_ENABLED = previous;
  }
});

test("candidate decisions accept approval and require reasoned rejection independently of verification", () => {
  expect(candidateReviewSchema.safeParse({ decision: "approved", reason: "" }).success).toBe(true);
  expect(candidateReviewSchema.safeParse({ decision: "rejected", reason: "Documented fictional policy finding" }).success).toBe(true);
  expect(candidateReviewSchema.safeParse({ decision: "rejected", reason: " " }).success).toBe(false);
  for (const decision of ["verified", "revoked", "draft"]) expect(candidateReviewSchema.safeParse({ decision }).success).toBe(false);
  expect(reviewSchema.safeParse({ decision: "approved" }).success).toBe(false);
});

test("configuration rejects reversed voting dates and nominations after voting", () => {
  expect(electionSchema.safeParse(initialElection).success).toBe(true);
  expect(
    electionSchema.safeParse({
      ...initialElection,
      votingEnd: "2026-11-19T08:00",
    }).success,
  ).toBe(false);
  expect(
    electionSchema.safeParse({
      ...initialElection,
      nominationsEnd: "2026-11-21",
    }).success,
  ).toBe(false);
  expect(
    electionSchema.safeParse({ ...initialElection, offices: [] }).success,
  ).toBe(false);
  expect(
    electionSchema.safeParse({
      ...initialElection,
      nominationsStart: "2026-02-30",
    }).success,
  ).toBe(false);
  expect(
    electionSchema.safeParse({
      ...initialElection,
      votingStart: "2026-11-20T27:00",
    }).success,
  ).toBe(false);
});
test("applications require a fictional registration, adequate manifesto, and demo consent", () => {
  const valid = {
    name: "Demo Student",
    registration: "DEMO-2026-123",
    email: "demo@example.test",
    phone: "+250 780 000 000",
    office: "President",
    bio: "A fictional student interested in inclusive student leadership.",
    manifesto:
      "I will support students with peer mentorship, transparent communication, and inclusive cultural and academic opportunities.",
    consent: true,
  };
  expect(applicationSchema.safeParse(valid).success).toBe(true);
  for (const invalid of [
    { ...valid, registration: "REAL-2026-001" },
    { ...valid, consent: false },
    { ...valid, manifesto: "short" },
    { ...valid, email: "invalid" },
    { ...valid, phone: "hello" },
    { ...valid, phone: "((((((((((" },
  ])
    expect(applicationSchema.safeParse(invalid).success).toBe(false);
});
test("sign-in validates without an authentication implementation", () => {
  expect(
    signInSchema.safeParse({ identifier: "", password: "123" }).success,
  ).toBe(false);
  expect(
    signInSchema.safeParse({
      identifier: "DEMO-2026-001",
      password: "fictional-only",
    }).success,
  ).toBe(true);
});
test("fixtures are explicit demo records and result percentages reconcile", () => {
  expect(
    initialVoters.every(
      (v) =>
        v.registration.startsWith("DEMO-") && v.email.endsWith("@example.test"),
    ),
  ).toBe(true);
  for (const result of publishedResults) {
    expect(
      result.entries.reduce((total, entry) => total + entry.votes, 0),
    ).toBe(200);
    expect(
      result.entries.reduce((total, entry) => total + entry.percentage, 0),
    ).toBe(100);
  }
  expect(percent(0, 0)).toBe(0);
  expect(matches("  MARIAM ", "Mariam Hassan")).toBe(true);
});

test("real registration requires a strong password and accepts no role claims", () => {
  expect(registrationSchema.safeParse({ registrationNumber: "STUDENT-001", email: "student@unilak.ac.rw", password: "Secure-UCSA-2026" }).success).toBe(true);
  expect(registrationSchema.safeParse({ registrationNumber: "STUDENT-001", email: "student@unilak.ac.rw", password: "short123", role: "committee_chair" }).success).toBe(false);
});
test("secure login validates the email address", () => {
  expect(loginSchema.safeParse({ email: "voter@unilak.ac.rw", password: "x" }).success).toBe(true);
  expect(loginSchema.safeParse({ email: "invalid", password: "x" }).success).toBe(false);
});
test("verification requests accept bounded registration identifiers", () => {
  expect(verificationRequestSchema.safeParse({ registrationNumber: " reg-2026-001 " }).success).toBe(true);
  expect(verificationRequestSchema.safeParse({ registrationNumber: "<script>" }).success).toBe(false);
});
test("roster imports reject duplicate registration numbers or emails", () => {
  expect(rosterSchema.safeParse({ records: [{ registrationNumber: "REG-001", email: "a@unilak.ac.rw" }, { registrationNumber: "REG-001", email: "b@unilak.ac.rw" }] }).success).toBe(false);
});
test("secure election configuration enforces unique offices and date order", () => {
  const valid = { title: "UCSA Annual Election", description: "Election for student leadership", nominationsStart: "2026-11-01T08:00", nominationsEnd: "2026-11-10T18:00", votingStart: "2026-11-12T08:00", votingEnd: "2026-11-12T18:00", offices: ["President", "Secretary General"] };
  expect(secureElectionSchema.safeParse(valid).success).toBe(true);
  expect(secureElectionSchema.safeParse({ ...valid, offices: ["President", " president "] }).success).toBe(false);
  expect(secureElectionSchema.safeParse({ ...valid, votingEnd: "2026-11-11T08:00" }).success).toBe(false);
});
