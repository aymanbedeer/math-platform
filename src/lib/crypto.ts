// Web Crypto only, so the same code runs on Node and on Cloudflare Workers.
const enc = new TextEncoder();

function toHex(buf: ArrayBuffer | Uint8Array) {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}
function fromHex(hex: string) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function randomHex(bytes = 32) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return toHex(a);
}

export async function sha256(s: string) {
  return toHex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
}

const ITER = 100_000;

export async function hashPassword(password: string, salt = randomHex(16), iter = ITER) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: fromHex(salt), iterations: iter }, key, 256);
  return `pbkdf2$${iter}$${salt}$${toHex(bits)}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [alg, iter, salt, hash] = stored.split("$");
  if (alg !== "pbkdf2") return false;
  const check = await hashPassword(password, salt, Number(iter));
  return safeEqual(check.split("$")[3], hash);
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function hmac(data: string) {
  const secret = process.env.APP_SECRET;
  if (!secret || secret.length < 16) throw new Error("APP_SECRET must be set (16+ chars)");
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

/** Short-lived token that ties a file link to one user. */
export async function signFileToken(fileId: number, userId: number, ttlSeconds = 600) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  return `${exp}.${await hmac(`${fileId}.${userId}.${exp}`)}`;
}

export async function verifyFileToken(token: string, fileId: number, userId: number) {
  const [expS, sig] = token.split(".");
  const exp = Number(expS);
  if (!exp || exp < Date.now() / 1000) return false;
  return safeEqual(await hmac(`${fileId}.${userId}.${exp}`), sig || "");
}

/** Easy-to-read temporary password without look-alike characters. */
export function tempPassword(len = 8) {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  const a = new Uint8Array(len);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => chars[b % chars.length]).join("");
}
