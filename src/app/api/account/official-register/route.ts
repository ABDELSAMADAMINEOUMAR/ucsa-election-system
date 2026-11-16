import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { readBoundedBody, readBoundedJson } from "@/lib/bounded-body";
import { readRegisterFile, REGISTER_BYTES } from "@/lib/official-register-file";
import { requireApiUser, errorResponse, sameOrigin } from "@/lib/supabase/http";

const schedule = z.object({
  title: z.string().trim().min(5).max(120),
  membershipOpens: z.iso.datetime({ offset: true, precision: -1 }),
  membershipCloses: z.iso.datetime({ offset: true, precision: -1 }),
  activationOpens: z.iso.datetime({ offset: true, precision: -1 }),
  activationCloses: z.iso.datetime({ offset: true, precision: -1 }),
  requestKey: z.uuid(),
  reason: z.string().max(1000).default(""),
});
export async function GET(request: NextRequest) {
  const auth = await requireApiUser();
  if (!auth.session) return auth.error;
  const id = z.uuid().safeParse(request.nextUrl.searchParams.get("id"));
  const page = z.coerce
    .number()
    .int()
    .min(1)
    .max(200)
    .safeParse(request.nextUrl.searchParams.get("page") ?? 1);
  if (!id.success || !page.success)
    return errorResponse(400, "Choose a register and page.");
  if (request.nextUrl.searchParams.get("source") === "1") {
    const source=await auth.session.client.rpc("get_register_source",{register_input:id.data});
    if(source.error||!source.data)return errorResponse(403,"Retained source is unavailable.");
    return new NextResponse(source.data.content,{headers:{"Content-Type":"application/json;charset=utf-8","Content-Disposition":"attachment; filename=ucsa-retained-register.json","X-Content-SHA256":source.data.sha256,"Cache-Control":"private, no-store"}});
  }
  const result = await auth.session.client.rpc("get_register_preview", {
    register_input: id.data,
    page_input: page.data,
  });
  if (result.error)
    return errorResponse(403, "Register preview is unavailable.");
  return NextResponse.json(result.data, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
export async function POST(request: NextRequest) {
  if (!sameOrigin(request))
    return errorResponse(403, "Request origin is not allowed.");
  const auth = await requireApiUser();
  if (!auth.session) return auth.error;
  const role = await auth.session.client.rpc("has_committee_role", {
    allowed: ["committee_chair", "verification_officer"],
  });
  if (role.data !== true)
    return errorResponse(
      403,
      "Only authorized global register reviewers can upload a register.",
    );
  if (request.headers.get("content-type") === "application/json") {
    const chair = await auth.session.client.rpc("has_committee_role", {
      allowed: ["committee_chair"],
    });
    if (chair.data !== true)
      return errorResponse(
        403,
        "Only a global chair can approve the register.",
      );
    const parsed = z
      .object({
        id: z.uuid(),
        snapshot: z.string().regex(/^[a-f0-9]{64}$/),
        confirmed: z.literal(true),
      })
      .strict()
      .safeParse(await readBoundedJson(request));
    if (!parsed.success)
      return errorResponse(400, "Review the register and confirm approval.");
    const result = await auth.session.client.rpc("approve_official_register", {
      register_input: parsed.data.id,
      hash_input: parsed.data.snapshot,
    });
    if (result.error)
      return errorResponse(
        409,
        "Approval could not complete. Resolve validation, identity conflicts, or independent correction review first.",
      );
    return NextResponse.json({ approved: true });
  }
  let values: Record<string, string>;
  try {
    values = Object.fromEntries(
      [
        "title",
        "membershipOpens",
        "membershipCloses",
        "activationOpens",
        "activationCloses",
        "requestKey",
        "reason",
      ].map((key) => [
        key,
        decodeURIComponent(request.headers.get(`x-${key}`) ?? ""),
      ]),
    );
  } catch {
    return errorResponse(400, "Invalid upload details.");
  }
  const metadata = schedule.safeParse(values);
  if (!metadata.success)
    return errorResponse(400, "Check the title and Kigali schedules.");
  const bytes = await readBoundedBody(request, REGISTER_BYTES);
  if (!bytes) return errorResponse(413, "File is too large or interrupted.");
  let fileName: string;
  try {
    fileName = decodeURIComponent(
      request.headers.get("x-file-name") ?? "",
    ).slice(0, 120);
  } catch {
    return errorResponse(400, "Invalid file name.");
  }
  try {
    const rows = readRegisterFile(bytes, fileName);
    const result = await auth.session.client.rpc("stage_official_register", {
      input: {
        ...metadata.data,
        classification: "synthetic",
        fileName,
        sourceSha256: createHash("sha256").update(bytes).digest("hex"),
        rows,
      },
    });
    if (result.error)
      return errorResponse(
        400,
        "Check the schedule and source file. A staged register does not grant access.",
      );
    return NextResponse.json({ id: result.data }, { status: 201 });
  } catch (error) {
    return errorResponse(
      400,
      error instanceof Error ? error.message : "File could not be read.",
    );
  }
}
