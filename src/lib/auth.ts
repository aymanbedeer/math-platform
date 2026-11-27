import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { randomHex, sha256 } from "./crypto";
import { subscriptionStatus } from "./subscription";

const COOKIE = "sid";
const MAX_AGE = 60 * 60 * 24 * 60; // 60 days

export const getSettings = cache(async () => {
  const [s] = await db.select().from(schema.settings).where(eq(schema.settings.id, 1));
  if (s) return s;
  const [created] = await db.insert(schema.settings).values({ id: 1 }).onConflictDoNothing().returning();
  return created ?? (await db.select().from(schema.settings))[0];
});

function deviceName(ua: string) {
  const os = /iPhone|iPad/.test(ua) ? "iPhone/iPad" : /Android/.test(ua) ? "Android"
    : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "جهاز";
  const br = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox"
    : /Safari\//.test(ua) ? "Safari" : "";
  return [os, br].filter(Boolean).join(" · ");
}

const DEVICE_COOKIE = "did";
const DEVICE_MAX_AGE = 60 * 60 * 24 * 365 * 5; // 5 years

/** This browser's device id: a random value kept in a long-lived cookie. Returns its sha256. */
async function deviceHash(create: boolean) {
  const c = await cookies();
  let key = c.get(DEVICE_COOKIE)?.value;
  if (!key || !/^[0-9a-f]{64}$/.test(key)) {
    if (!create) return null;
    key = randomHex(32);
    c.set(DEVICE_COOKIE, key, {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: DEVICE_MAX_AGE,
    });
  }
  return sha256(key);
}

/**
 * Binds a student to the device they sign in from. A registered device is let in; a new device
 * is registered while the student has fewer than settings.maxDevices; otherwise sign-in is refused
 * (and logged) until the teacher removes the old device. Teachers are never restricted.
 */
export async function bindDevice(user: schema.User): Promise<boolean> {
  if (user.role !== "student") return true;
  const ua = (await headers()).get("user-agent") || "";
  const hash = (await deviceHash(true))!;
  const mine = await db.select().from(schema.devices).where(eq(schema.devices.userId, user.id));
  const known = mine.find((d) => d.keyHash === hash);
  if (known) {
    await db.update(schema.devices).set({ lastSeenAt: new Date() }).where(eq(schema.devices.id, known.id));
    return true;
  }
  const s = await getSettings();
  if (mine.length >= s.maxDevices) {
    await db.insert(schema.accountEvents).values({ studentId: user.id, kind: "device_blocked", note: deviceName(ua) });
    return false;
  }
  await db.insert(schema.devices).values({ userId: user.id, keyHash: hash, name: deviceName(ua) });
  await db.insert(schema.accountEvents).values({ studentId: user.id, kind: "device_registered", note: deviceName(ua) });
  return true;
}

/** Creates a session cookie for the user (call bindDevice first for students). */
export async function createSession(user: schema.User) {
  const ua = (await headers()).get("user-agent") || "";
  const token = randomHex(32);
  await db.insert(schema.sessions).values({ id: await sha256(token), userId: user.id, device: deviceName(ua) });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: MAX_AGE,
  });
}

export const getCurrent = cache(async () => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const id = await sha256(token);
  const [row] = await db.select({ session: schema.sessions, user: schema.users })
    .from(schema.sessions).innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.id, id), isNull(schema.sessions.revokedAt)));
  if (!row) return null;
  // A student's session only works on a device that is still registered to them.
  if (row.user.role === "student") {
    const hash = await deviceHash(false);
    const [dev] = hash ? await db.select({ id: schema.devices.id }).from(schema.devices)
      .where(and(eq(schema.devices.userId, row.user.id), eq(schema.devices.keyHash, hash))) : [];
    if (!dev) return null;
  }
  // Throttle "last seen" writes to once every 5 minutes
  if (Date.now() - row.session.lastSeenAt.getTime() > 5 * 60 * 1000) {
    const now = new Date();
    await db.update(schema.sessions).set({ lastSeenAt: now }).where(eq(schema.sessions.id, id));
    await db.update(schema.users).set({ lastSeenAt: now }).where(eq(schema.users.id, row.user.id));
  }
  return { user: row.user, sessionId: id };
});

export async function destroySession() {
  const c = await cookies();
  const token = c.get(COOKIE)?.value;
  if (token) {
    await db.update(schema.sessions).set({ revokedAt: new Date() }).where(eq(schema.sessions.id, await sha256(token)));
  }
  c.delete(COOKIE);
}

export async function requireTeacher() {
  const cur = await getCurrent();
  if (!cur) redirect("/login");
  if (cur.user.role !== "teacher") redirect("/");
  return cur.user;
}

/** A logged-in student plus whether their subscription currently allows paid content. */
export async function requireStudent() {
  const cur = await getCurrent();
  if (!cur) redirect("/login");
  if (cur.user.role !== "student") redirect("/t");
  const s = await getSettings();
  const status = subscriptionStatus(cur.user, s.graceDays);
  return { user: cur.user, status, settings: s, canViewPaid: status !== "locked" };
}
