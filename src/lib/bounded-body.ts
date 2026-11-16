/** Enforce the actual stream length, including requests without Content-Length. */
export async function readBoundedBody(request: Request, maxBytes: number): Promise<Uint8Array | null> {
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) return null;
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) { await reader.cancel(); return null; }
      chunks.push(value);
    }
  } catch { return null; }
  finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

// Accommodates a 250-row roster import while bounding anonymous Auth requests
// and all other JSON handlers before parsing/allocating the decoded payload.
export const MAX_JSON_BYTES = 128 * 1024;
export async function readBoundedJson(request: Request): Promise<unknown> {
  const bytes = await readBoundedBody(request, MAX_JSON_BYTES);
  if (!bytes?.byteLength) return null;
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { return null; }
}
