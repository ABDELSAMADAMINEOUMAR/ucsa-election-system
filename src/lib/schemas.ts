import { z } from "zod";
export const applicationSchema = z.object({
  name: z.string().trim().min(3, "Enter your full name.").max(100),
  registration: z
    .string()
    .trim()
    .regex(
      /^DEMO-[A-Z0-9-]{4,24}$/i,
      "Use a demo registration such as DEMO-2026-001.",
    ),
  email: z.email("Enter a valid email address.").max(160),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[\d\s()-]{9,20}$/, "Enter a valid phone number.")
    .refine((value) => {
      const digits = value.replace(/\D/g, "").length;
      return digits >= 9 && digits <= 15;
    }, "Enter a valid phone number."),
  office: z.enum(["President", "Secretary General", "Treasurer"]),
  bio: z.string().trim().min(30, "Write at least 30 characters.").max(1000),
  manifesto: z
    .string()
    .trim()
    .min(80, "Write at least 80 characters.")
    .max(5000),
  consent: z.boolean().refine((v) => v, "Confirm that this is a simulation."),
});
export const electionSchema = z
  .object({
    title: z.string().trim().min(5, "Enter at least 5 characters.").max(120),
    description: z
      .string()
      .trim()
      .min(20, "Enter at least 20 characters.")
      .max(1500),
    nominationsStart: z.iso.date("Select a valid date."),
    nominationsEnd: z.iso.date("Select a valid date."),
    votingStart: z.iso.datetime({
      local: true,
      precision: -1,
      error: "Select a valid date and time.",
    }),
    votingEnd: z.iso.datetime({
      local: true,
      precision: -1,
      error: "Select a valid date and time.",
    }),
    offices: z
      .array(z.enum(["President", "Secretary General", "Treasurer"]))
      .min(1, "Select at least one office."),
  })
  .superRefine((data, ctx) => {
    if (data.nominationsEnd < data.nominationsStart)
      ctx.addIssue({
        code: "custom",
        path: ["nominationsEnd"],
        message: "Nominations must end after they start.",
      });
    if (data.votingStart.slice(0, 10) <= data.nominationsEnd)
      ctx.addIssue({
        code: "custom",
        path: ["votingStart"],
        message: "Voting must start after nominations close.",
      });
    if (data.votingEnd <= data.votingStart)
      ctx.addIssue({
        code: "custom",
        path: ["votingEnd"],
        message: "Voting must end after it starts.",
      });
  });
export const signInSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(4, "Enter your email or registration number.")
    .max(160)
    .refine(
      (value) =>
        z.email().safeParse(value).success ||
        /^DEMO-[A-Z0-9-]{4,24}$/i.test(value),
      "Enter a valid email or demo registration number.",
    ),
  password: z.string().min(8, "Enter at least 8 characters.").max(128),
});
