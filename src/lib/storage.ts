// File storage. "local" keeps files in ./uploads (development);
// "supabase" uses a private Supabase Storage bucket (production, free tier).
import { randomHex } from "./crypto";

const driver = process.env.STORAGE_DRIVER || "local";

function supa(path: string) {
  const base = process.env.SUPABASE_URL!.replace(/\/$/, "");
  const bucket = process.env.SUPABASE_BUCKET || "lesson-files";
  return `${base}/storage/v1/object/${bucket}/${path}`;
}
function supaHeaders(extra: Record<string, string> = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return { Authorization: `Bearer ${key}`, apikey: key, ...extra };
}

export function newKey(ext: string) {
  return `${new Date().toISOString().slice(0, 7)}/${randomHex(12)}.${ext}`;
}

export async function putFile(key: string, data: ArrayBuffer, contentType: string) {
  if (driver === "supabase") {
    const r = await fetch(supa(key), {
      method: "POST",
      headers: supaHeaders({ "Content-Type": contentType, "x-upsert": "true" }),
      body: data,
    });
    if (!r.ok) throw new Error(`Upload failed: ${r.status} ${await r.text()}`);
    return;
  }
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const full = path.join(process.cwd(), "uploads", key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, Buffer.from(data));
}

export async function getFile(key: string): Promise<ArrayBuffer | null> {
  if (driver === "supabase") {
    const r = await fetch(supa(key), { headers: supaHeaders() });
    if (!r.ok) return null;
    return r.arrayBuffer();
  }
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  try {
    const b = await fs.readFile(path.join(process.cwd(), "uploads", key));
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
  } catch {
    return null;
  }
}

export async function deleteFile(key: string) {
  if (driver === "supabase") {
    await fetch(supa(key), { method: "DELETE", headers: supaHeaders() });
    return;
  }
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  await fs.rm(path.join(process.cwd(), "uploads", key), { force: true });
}
