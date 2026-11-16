import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { errorResponse, requireApiUser, sameOrigin } from "@/lib/supabase/http";
import { readBoundedBody } from "@/lib/bounded-body";
import sharp from "sharp";

const maxBytes = 5 * 1024 * 1024;
const allowed = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"], ["application/pdf", "pdf"]]);
export async function POST(request: NextRequest, { params }: RouteContext<"/api/account/complaints/[id]/evidence">) {
  if (!sameOrigin(request)) return errorResponse(403, "Request origin is not allowed.");
  const auth = await requireApiUser(); if (auth.error || !auth.session) return auth.error;
  const { id } = await params;
  const { data: owns } = await auth.session.client.from("complaints").select("id").eq("id", id).eq("student_id", auth.session.user.id).in("status", ["submitted", "under_review", "awaiting_information"]).maybeSingle();
  if (!owns) return errorResponse(404, "Complaint is unavailable.");
  const type = request.headers.get("content-type")?.split(";")[0] ?? ""; const extension = allowed.get(type);
  if (!extension) return errorResponse(415, "Choose a JPEG, PNG, WebP, or PDF file.");
  const bytes = await readBoundedBody(request, maxBytes);
  if (!bytes?.byteLength) return errorResponse(413, "Choose a supported file no larger than 5 MB.");
  const signatureMatches = type === "image/jpeg" ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    : type === "image/png" ? bytes.subarray(0, 8).join(",") === "137,80,78,71,13,10,26,10"
      : type === "image/webp" ? new TextDecoder().decode(bytes.subarray(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.subarray(8, 12)) === "WEBP"
        : new TextDecoder().decode(bytes.subarray(0, 5)) === "%PDF-";
  if (!signatureMatches) return errorResponse(415, "The file contents do not match the selected file type.");
  // A magic header alone does not establish that an image can be decoded.
  if (type.startsWith("image/")) {
    try { await sharp(bytes, { limitInputPixels: 12_000_000, failOn: "error" }).stats(); }
    catch { return errorResponse(415, "The evidence image could not be decoded safely."); }
  }
  let nameHeader: string;
  try { nameHeader = decodeURIComponent(request.headers.get("x-file-name") ?? `evidence.${extension}`).slice(0, 120); }
  catch { return errorResponse(400, "The file name is invalid."); }
  const cleanName = nameHeader.replace(/[\\/\u0000-\u001f]/g, "_") || `evidence.${extension}`;
  const path = `${auth.session.user.id}/${id}/${randomUUID()}.${extension}`;
  let admin: ReturnType<typeof createSupabaseAdminClient>;
  try { admin = createSupabaseAdminClient(); } catch { return errorResponse(503, "Private evidence storage is not configured."); }
  const uploaded = await admin.storage.from("complaint-private").upload(path, bytes, { contentType: type, upsert: false });
  if (uploaded.error) return errorResponse(500, "Evidence could not be stored privately.");
  const { error } = await admin.rpc("record_complaint_document", { complaint_id_input: id, path_input: path, file_name_input: cleanName, mime_input: type, size_input: bytes.byteLength });
  if (error) { await admin.storage.from("complaint-private").remove([path]); return errorResponse(403, "Evidence could not be attached to this complaint."); }
  return NextResponse.json({ uploaded: true }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
}
export async function GET(_request: NextRequest, { params }: RouteContext<"/api/account/complaints/[id]/evidence">) {
  const auth = await requireApiUser(); if (auth.error || !auth.session) return auth.error;
  const { id } = await params; const documentId = new URL(_request.url).searchParams.get("document");
  if (!documentId) return errorResponse(400, "Evidence is unavailable.");
  const { data: path, error } = await auth.session.client.rpc("get_complaint_document_path", { complaint_id_input: id, document_id_input: documentId });
  if (error || typeof path !== "string") return errorResponse(404, "Evidence is unavailable.");
  let admin: ReturnType<typeof createSupabaseAdminClient>;
  try { admin = createSupabaseAdminClient(); } catch { return errorResponse(503, "Private evidence storage is not configured."); }
  const { data, error: signError } = await admin.storage.from("complaint-private").createSignedUrl(path, 60, { download: true });
  if (signError || !data?.signedUrl) return errorResponse(404, "Evidence is unavailable.");
  return NextResponse.redirect(data.signedUrl, { headers: { "Cache-Control": "private, no-store" } });
}
