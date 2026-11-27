"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, isNull, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { bindDevice, createSession, destroySession, getCurrent } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/crypto";
import { getI18n } from "@/i18n/server";

const MAX_FAILS = 5;
const LOCK_MINUTES = 15;

export type FormState = { error?: string; ok?: string } | undefined;

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const { t } = await getI18n();
  const username = String(form.get("username") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  if (!username || !password) return { error: t("اكتب اسم المستخدم وكلمة المرور") };

  const [user] = await db.select().from(schema.users).where(eq(schema.users.username, username));
  if (!user) {
    await verifyPassword(password, "pbkdf2$100000$00$00"); // similar timing for unknown users
    return { error: t("اسم المستخدم أو كلمة المرور غير صحيحة") };
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return { error: t("تم إيقاف المحاولات مؤقتًا بسبب كثرة الأخطاء. حاول بعد {m} دقيقة.", { m: LOCK_MINUTES }) };
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    const fails = user.failedLogins + 1;
    await db.update(schema.users).set(
      fails >= MAX_FAILS
        ? { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) }
        : { failedLogins: fails },
    ).where(eq(schema.users.id, user.id));
    return { error: t("اسم المستخدم أو كلمة المرور غير صحيحة") };
  }
  await db.update(schema.users).set({ failedLogins: 0, lockedUntil: null, lastSeenAt: new Date() })
    .where(eq(schema.users.id, user.id));
  if (!(await bindDevice(user))) {
    return { error: t("هذا الحساب مسجّل على جهاز آخر. لفتح المنصة من هذا الجهاز اطلب من الأستاذ إزالة الجهاز القديم.") };
  }
  await createSession(user);
  redirect(user.role === "teacher" ? "/t" : "/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

export async function requestPasswordReset(_: FormState, form: FormData): Promise<FormState> {
  const { t } = await getI18n();
  const username = String(form.get("username") || "").trim().toLowerCase();
  if (!username) return { error: t("اكتب اسم المستخدم") };
  // Same answer whether or not the user exists; one open request per username.
  const [open] = await db.select().from(schema.passwordRequests)
    .where(and(eq(schema.passwordRequests.username, username), eq(schema.passwordRequests.handled, false)));
  if (!open) await db.insert(schema.passwordRequests).values({ username: username.slice(0, 64) });
  return { ok: t("تم إرسال طلبك للأستاذ. سيتواصل معك بكلمة مرور جديدة.") };
}

export async function changeOwnPassword(_: FormState, form: FormData): Promise<FormState> {
  const { t } = await getI18n();
  const cur = await getCurrent();
  if (!cur) redirect("/login");
  const oldPw = String(form.get("old") || "");
  const newPw = String(form.get("new") || "");
  const confirm = String(form.get("confirm") || "");
  if (!(await verifyPassword(oldPw, cur.user.passwordHash))) return { error: t("كلمة المرور الحالية غير صحيحة") };
  if (newPw.length < 6) return { error: t("كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل") };
  if (newPw !== confirm) return { error: t("كلمتا المرور غير متطابقتين") };
  await db.update(schema.users).set({ passwordHash: await hashPassword(newPw), mustChangePassword: false })
    .where(eq(schema.users.id, cur.user.id));
  // Sign out every other device
  await db.update(schema.sessions).set({ revokedAt: new Date() })
    .where(and(eq(schema.sessions.userId, cur.user.id), ne(schema.sessions.id, cur.sessionId), isNull(schema.sessions.revokedAt)));
  return { ok: t("تم تغيير كلمة المرور") };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** A user edits their own profile: personal email and phone. The teacher can also change their own name. */
export async function updateProfile(_: FormState, form: FormData): Promise<FormState> {
  const { t } = await getI18n();
  const cur = await getCurrent();
  if (!cur) redirect("/login");
  const email = String(form.get("email") || "").trim().toLowerCase();
  const phone = String(form.get("phone") || "").trim();
  if (email && (email.length > 200 || !EMAIL_RE.test(email))) return { error: t("البريد الإلكتروني غير صحيح") };
  if (phone && !/^\+?[0-9 ]{7,20}$/.test(phone)) return { error: t("رقم الهاتف غير صحيح") };
  const patch: Partial<schema.User> = { email: email || null, phone: phone || null };
  if (cur.user.role === "teacher") {
    const fullName = String(form.get("fullName") || "").trim();
    if (!fullName || fullName.length > 100) return { error: t("اكتب الاسم") };
    patch.fullName = fullName;
  }
  await db.update(schema.users).set(patch).where(eq(schema.users.id, cur.user.id));
  revalidatePath("/", "layout");
  return { ok: t("تم حفظ بياناتك") };
}
