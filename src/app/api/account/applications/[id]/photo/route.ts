import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import sharp from "sharp";
import { errorResponse, requireApiUser, sameOrigin, safeErrorResponse } from "@/lib/supabase/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readBoundedBody } from "@/lib/bounded-body";

function detectImage(bytes: Uint8Array) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "image/png";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

export async function POST(request: NextRequest, { params }: RouteContext<"/api/account/applications/[id]/photo">) {
  if (!sameOrigin(request)) return errorResponse(403, "Request origin is not allowed.");
  const auth = await requireApiUser();
  if (auth.error || !auth.session) return auth.error;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return errorResponse(400, "Invalid application.");
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > 2 * 1024 * 1024 + 64 * 1024) return errorResponse(413, "Photo must be no larger than 2 MB.");
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) return errorResponse(415, "Send a JPEG, PNG, or WebP photo.");
  let form: FormData | null = null;
  if (request.body) {
    const body = await readBoundedBody(request, 2 * 1024 * 1024 + 64 * 1024);
    if (!body) return errorResponse(400, "The photo upload is invalid or exceeds 2 MB.");
    const contentType = request.headers.get("content-type")!;
    try { form = await new Request("http://localhost/upload", { method: "POST", headers: { "content-type": contentType }, body: new Blob([body.buffer as ArrayBuffer]) }).formData(); }
    catch { return errorResponse(400, "The photo upload is invalid."); }
  }
  const file = form?.get("photo");
  if (!(file instanceof File) || file.size < 1 || file.size > 2 * 1024 * 1024) return errorResponse(400, "Select a photo up to 2 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const detectedMime = detectImage(bytes);
  if (!detectedMime) return errorResponse(415, "Upload a JPEG, PNG, or WebP photo.");
  let normalized: Buffer;
  try {
    const decoder = sharp(bytes, { limitInputPixels: 12_000_000, failOn: "error" });
    const metadata = await decoder.metadata();
    if (!metadata.width || !metadata.height || metadata.width > 5000 || metadata.height > 5000 || !["jpeg", "png", "webp"].includes(metadata.format ?? "")) return errorResponse(415, "The photo dimensions or format are not supported.");
    if ((metadata.format === "jpeg" && detectedMime !== "image/jpeg") || (metadata.format === "png" && detectedMime !== "image/png") || (metadata.format === "webp" && detectedMime !== "image/webp")) return errorResponse(415, "The photo file is invalid.");
    normalized = await sharp(bytes, { limitInputPixels: 12_000_000, failOn: "error" }).rotate().resize(1024, 1024, { fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  } catch { return errorResponse(415, "The photo could not be decoded safely."); }
  if (normalized.length > 2 * 1024 * 1024) return errorResponse(413, "The processed photo is larger than 2 MB.");

  const { data: application, error: lookupError } = await auth.session.client.from("candidate_applications")
    .select("id,user_id,status").eq("id", id).eq("user_id", auth.session.user.id).maybeSingle();
  if (lookupError) return safeErrorResponse(lookupError);
  if (!application || application.status !== "draft") return errorResponse(404, "Only your own draft application can receive a photo.");

  const { data: existingPhoto, error: photoLookupError } = await auth.session.client.from("candidate_application_documents").select("id,storage_path").eq("application_id", id).maybeSingle();
  if (photoLookupError) return safeErrorResponse(photoLookupError);
  if (existingPhoto) {
    // A lost upload response can be retried with identical normalized bytes.
    // A different photograph still requires an explicit replacement workflow.
    try {
      const admin = createSupabaseAdminClient();
      const stored = await admin.storage.from("candidate-private").download(existingPhoto.storage_path);
      if (stored.error || !stored.data) return errorResponse(503, "The attached photo could not be verified.");
      if (!normalized.equals(Buffer.from(await stored.data.arrayBuffer()))) return errorResponse(409, "This application already has a different photo.");
      const { error } = await auth.session.client.rpc("record_candidate_photo_upload", { application_id_input: id });
      if (error) return errorResponse(409, "The draft photo could not be confirmed.");
      return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
    } catch (error) { return safeErrorResponse(error); }
  }
  const path = `${auth.session.user.id}/${id}/portrait-${crypto.randomUUID()}.webp`;
  try {
    const admin = createSupabaseAdminClient();
    const { error: uploadError } = await admin.storage.from("candidate-private").upload(path, new Blob([Uint8Array.from(normalized)], { type: "image/webp" }), { contentType: "image/webp", upsert: false });
    if (uploadError) return errorResponse(500, "The private photo could not be saved.");
    const { error: documentError } = await admin.from("candidate_application_documents").insert({ application_id: id, storage_path: path, mime_type: "image/webp", byte_size: normalized.length });
    if (documentError) {
      await admin.storage.from("candidate-private").remove([path]);
      return errorResponse(500, "The private photo could not be attached.");
    }
    const { error: auditError } = await auth.session.client.rpc("record_candidate_photo_upload", { application_id_input: id });
    if (auditError) {
      await admin.from("candidate_application_documents").delete().eq("application_id", id).eq("storage_path", path);
      await admin.storage.from("candidate-private").remove([path]);
      return errorResponse(500, "The photo upload could not be recorded.");
    }
    return NextResponse.json({ ok: true }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return safeErrorResponse(error); }
}
