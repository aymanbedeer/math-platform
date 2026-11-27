"use server";
import { notifyStudents } from "@/lib/notify";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, isNull, like, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { getSettings, requireTeacher } from "@/lib/auth";
import { hashPassword, tempPassword } from "@/lib/crypto";
import { addDays, today } from "@/lib/dates";
import { paymentPeriod } from "@/lib/subscription";
import { youtubeId } from "@/lib/youtube";
import { deleteFile, newKey, putFile } from "@/lib/storage";
import { getI18n } from "@/i18n/server";

export type CredState = { error?: string; username?: string; password?: string; name?: string } | undefined;
export type MsgState = { error?: string; ok?: string } | undefined;

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const int = (f: FormData, k: string, d = 0) => {
  const n = parseInt(str(f, k), 10);
  return Number.isFinite(n) ? n : d;
};
const gradeIds = async () => (await db.select({ id: schema.grades.id }).from(schema.grades)).map((r) => r.id);
/** The chosen group id if it belongs to the given grade, else null. */
const groupFor = async (f: FormData, gradeId: number) => {
  const id = int(f, "group");
  if (!id) return null;
  const [g] = await db.select().from(schema.groups).where(and(eq(schema.groups.id, id), eq(schema.groups.gradeId, gradeId)));
  return g ? g.id : null;
};
const grade = async (f: FormData) => {
  const g = int(f, "grade");
  if (!(await gradeIds()).includes(g)) throw new Error("bad grade");
  return g;
};

async function log(studentId: number, kind: string, note?: string) {
  await db.insert(schema.accountEvents).values({ studentId, kind, note });
}

// Latin transliteration is unreliable for Arabic names, so usernames are "s" + a short number,
// unless the teacher types one.
async function makeUsername(wanted: string) {
  const clean = wanted.toLowerCase().replace(/[^a-z0-9._-]/g, "");
  if (clean) return clean;
  const rows = await db.select({ u: schema.users.username }).from(schema.users).where(like(schema.users.username, "s%"));
  const taken = new Set(rows.map((r) => r.u));
  for (let n = 1000 + rows.length; ; n++) if (!taken.has(`s${n}`)) return `s${n}`;
}

// ---------- Students ----------

export async function createStudent(_: CredState, f: FormData): Promise<CredState> {
  const { t } = await getI18n();
  await requireTeacher();
  const fullName = str(f, "fullName");
  if (!fullName) return { error: t("اكتب اسم الطالب") };
  const username = await makeUsername(str(f, "username"));
  const [exists] = await db.select().from(schema.users).where(eq(schema.users.username, username));
  if (exists) return { error: t("اسم المستخدم {u} مستخدم بالفعل", { u: username }) };
  const password = tempPassword();
  const g = await grade(f);
  const [st] = await db.insert(schema.users).values({
    role: "student", username, fullName, grade: g, parentPhone: str(f, "parentPhone") || null, groupId: await groupFor(f, g),
    passwordHash: await hashPassword(password),
  }).returning();
  await log(st.id, "created");
  const months = int(f, "months");
  if (months > 0) await recordPaymentFor(st.id, int(f, "amount"), months, str(f, "method") === "transfer" ? "transfer" : "cash", "");
  revalidatePath("/t", "layout");
  return { username, password, name: fullName };
}

export async function updateStudent(id: number, f: FormData) {
  await requireTeacher();
  const g = await grade(f);
  await db.update(schema.users).set({
    fullName: str(f, "fullName"), grade: g, parentPhone: str(f, "parentPhone") || null, groupId: await groupFor(f, g),
  }).where(and(eq(schema.users.id, id), eq(schema.users.role, "student")));
  revalidatePath("/t", "layout");
}

/**
 * Move several students at once. Choosing a group also moves them to that group's grade.
 * Choosing only a grade keeps each student's group if it belongs to that grade, else clears it.
 */
export async function bulkUpdateStudents(f: FormData) {
  await requireTeacher();
  const ids = f.getAll("ids").map((v) => parseInt(String(v), 10)).filter(Number.isFinite);
  if (!ids.length) return;
  const mine = and(inArray(schema.users.id, ids), eq(schema.users.role, "student"));
  const [grp] = int(f, "group") ? await db.select().from(schema.groups).where(eq(schema.groups.id, int(f, "group"))) : [];
  const g = int(f, "grade");
  if (grp) {
    await db.update(schema.users).set({ groupId: grp.id, grade: grp.gradeId }).where(mine);
  } else if ((await gradeIds()).includes(g)) {
    await db.update(schema.users).set({ grade: g }).where(mine);
    await db.update(schema.users).set({ groupId: null }).where(and(mine,
      sql`${schema.users.groupId} is not null and ${schema.users.groupId} not in (select id from groups where grade_id = ${g})`));
  }
  if (f.get("clearGroup")) await db.update(schema.users).set({ groupId: null }).where(mine);
  revalidatePath("/t", "layout");
}

export async function deleteStudent(id: number) {
  await requireTeacher();
  await db.delete(schema.users).where(and(eq(schema.users.id, id), eq(schema.users.role, "student")));
  revalidatePath("/t", "layout");
  redirect("/t/students");
}

async function recordPaymentFor(studentId: number, amount: number, months: number, method: "cash" | "transfer", note: string) {
  const { t } = await getI18n();
  const s = await getSettings();
  const [st] = await db.select().from(schema.users).where(eq(schema.users.id, studentId));
  const { from, to } = paymentPeriod(st, months, s.graceDays);
  await db.transaction(async (tx) => {
    await tx.insert(schema.payments).values({ studentId, amount, months, method, periodFrom: from, periodTo: to, note: note || null });
    await tx.update(schema.users).set({ expiresAt: to }).where(eq(schema.users.id, studentId));
    await tx.insert(schema.accountEvents).values({
      studentId, kind: "payment",
      note: t("دفع {amount} ({method}) عن {months} شهر، حتى {to}", { amount, method: method === "cash" ? t("نقدًا") : t("تحويل"), months, to }),
    });
  });
}

export async function recordPayment(id: number, f: FormData) {
  await requireTeacher();
  const months = Math.min(Math.max(int(f, "months", 1), 1), 12);
  await recordPaymentFor(id, Math.max(int(f, "amount"), 0), months, str(f, "method") === "transfer" ? "transfer" : "cash", str(f, "note"));
  revalidatePath("/t", "layout");
}

export async function suspendStudent(id: number, f: FormData) {
  const { t } = await getI18n();
  await requireTeacher();
  const reason = str(f, "reason") || t("إيقاف يدوي");
  await db.update(schema.users).set({ suspended: true, suspendReason: reason }).where(eq(schema.users.id, id));
  await log(id, "suspend", reason);
  revalidatePath("/t", "layout");
}

export async function activateStudent(id: number) {
  const { t } = await getI18n();
  await requireTeacher();
  await db.update(schema.users).set({ suspended: false, suspendReason: null }).where(eq(schema.users.id, id));
  await log(id, "activate", t("إلغاء الإيقاف اليدوي"));
  revalidatePath("/t", "layout");
}

export async function setExempt(id: number, exempt: boolean) {
  const { t } = await getI18n();
  await requireTeacher();
  await db.update(schema.users).set({ exempt }).where(eq(schema.users.id, id));
  await log(id, exempt ? "exempt" : "unexempt", exempt ? t("إعفاء من الدفع") : t("إلغاء الإعفاء"));
  revalidatePath("/t", "layout");
}

export async function extendStudent(id: number, f: FormData) {
  const { t } = await getI18n();
  await requireTeacher();
  const days = int(f, "days");
  if (days <= 0) return;
  const [st] = await db.select().from(schema.users).where(eq(schema.users.id, id));
  const base = st.expiresAt && st.expiresAt >= today() ? st.expiresAt : today();
  const to = addDays(base, days);
  await db.update(schema.users).set({ expiresAt: to }).where(eq(schema.users.id, id));
  await log(id, "extend", t("تمديد يدوي {days} يوم حتى {to}", { days, to }));
  revalidatePath("/t", "layout");
}

export async function resetPassword(id: number): Promise<CredState> {
  await requireTeacher();
  const password = tempPassword();
  const [st] = await db.update(schema.users)
    .set({ passwordHash: await hashPassword(password), mustChangePassword: true, failedLogins: 0, lockedUntil: null })
    .where(and(eq(schema.users.id, id), eq(schema.users.role, "student"))).returning();
  await db.update(schema.sessions).set({ revokedAt: new Date() })
    .where(and(eq(schema.sessions.userId, id), isNull(schema.sessions.revokedAt)));
  await db.update(schema.passwordRequests).set({ handled: true }).where(eq(schema.passwordRequests.username, st.username));
  await log(id, "password_reset");
  revalidatePath("/t", "layout");
  return { username: st.username, password, name: st.fullName };
}

export async function endSessions(id: number) {
  const { t } = await getI18n();
  await requireTeacher();
  await db.update(schema.sessions).set({ revokedAt: new Date() })
    .where(and(eq(schema.sessions.userId, id), isNull(schema.sessions.revokedAt)));
  await log(id, "sessions_ended", t("إنهاء كل الجلسات المفتوحة"));
  revalidatePath(`/t/students/${id}`);
}

/** Removes a registered device so the student can sign in from a new one; also signs out that student everywhere. */
export async function removeDevice(studentId: number, deviceId: number) {
  const { t } = await getI18n();
  await requireTeacher();
  const [d] = await db.select().from(schema.devices)
    .where(and(eq(schema.devices.id, deviceId), eq(schema.devices.userId, studentId)));
  if (!d) return;
  await db.delete(schema.devices).where(eq(schema.devices.id, d.id));
  await db.update(schema.sessions).set({ revokedAt: new Date() })
    .where(and(eq(schema.sessions.userId, studentId), isNull(schema.sessions.revokedAt)));
  await log(studentId, "device_removed", d.name || t("جهاز"));
  revalidatePath(`/t/students/${studentId}`);
}

export async function dismissRequest(id: number) {
  await requireTeacher();
  await db.update(schema.passwordRequests).set({ handled: true }).where(eq(schema.passwordRequests.id, id));
  revalidatePath("/t");
}

// ---------- Content ----------

export async function createUnit(f: FormData) {
  await requireTeacher();
  const title = str(f, "title");
  if (!title) return;
  await db.insert(schema.units).values({ grade: await grade(f), title, position: int(f, "position"), visibleFrom: str(f, "visibleFrom") || null });
  revalidatePath("/t/content");
}

export async function updateUnit(id: number, f: FormData) {
  await requireTeacher();
  await db.update(schema.units).set({ title: str(f, "title"), position: int(f, "position"), visibleFrom: str(f, "visibleFrom") || null })
    .where(eq(schema.units.id, id));
  revalidatePath("/t/content");
}

export async function deleteUnit(id: number) {
  await requireTeacher();
  const files = await db.select({ k: schema.lessonFiles.storageKey }).from(schema.lessonFiles)
    .innerJoin(schema.lessons, eq(schema.lessons.id, schema.lessonFiles.lessonId)).where(eq(schema.lessons.unitId, id));
  for (const { k } of files) if (k) await deleteFile(k);
  await db.delete(schema.units).where(eq(schema.units.id, id));
  revalidatePath("/t/content");
}

export async function createLesson(unitId: number, f: FormData) {
  await requireTeacher();
  const title = str(f, "title");
  if (!title) return;
  const [l] = await db.insert(schema.lessons).values({ unitId, title, position: int(f, "position") }).returning();
  redirect(`/t/lessons/${l.id}`);
}

export async function updateLesson(id: number, f: FormData) {
  await requireTeacher();
  const status = (["draft", "published", "free"] as const).find((s) => s === str(f, "status")) ?? "draft";
  const [prev] = await db.select().from(schema.lessons).where(eq(schema.lessons.id, id));
  await db.update(schema.lessons).set({
    title: str(f, "title"), description: str(f, "description"), position: int(f, "position"), status,
    publishedAt: status !== "draft" && !prev.publishedAt ? new Date() : prev.publishedAt,
  }).where(eq(schema.lessons.id, id));
  if (prev.status === "draft" && status !== "draft") await notifyLesson(id, "lesson");
  revalidatePath(`/t/lessons/${id}`);
  revalidatePath("/t/content");
}

/** Tells the lesson's grade about a newly visible lesson, or a file added to a visible one. */
async function notifyLesson(lessonId: number, kind: "lesson" | "file", file = "") {
  const [row] = await db.select({ l: schema.lessons, grade: schema.units.grade }).from(schema.lessons)
    .innerJoin(schema.units, eq(schema.units.id, schema.lessons.unitId)).where(eq(schema.lessons.id, lessonId));
  if (!row || row.l.status === "draft") return;
  await notifyStudents({ gradeId: row.grade }, kind, { title: row.l.title, file }, `/lessons/${lessonId}`);
}

export async function deleteLesson(id: number) {
  await requireTeacher();
  const files = await db.select().from(schema.lessonFiles).where(eq(schema.lessonFiles.lessonId, id));
  for (const file of files) if (file.storageKey) await deleteFile(file.storageKey);
  await db.delete(schema.lessons).where(eq(schema.lessons.id, id));
  redirect("/t/content");
}

export async function addVideo(lessonId: number, _: MsgState, f: FormData): Promise<MsgState> {
  const { t } = await getI18n();
  await requireTeacher();
  const vid = youtubeId(str(f, "url"));
  if (!vid) return { error: t("الرابط غير صحيح. انسخ رابط الفيديو من YouTube كما هو.") };
  const vtitle = str(f, "title") || t("فيديو الدرس");
  await db.insert(schema.lessonFiles).values({ lessonId, kind: "video", title: vtitle, url: vid, position: int(f, "position") });
  await notifyLesson(lessonId, "file", vtitle);
  revalidatePath(`/t/lessons/${lessonId}`);
  return { ok: t("تمت إضافة الفيديو") };
}

export async function addLink(lessonId: number, _: MsgState, f: FormData): Promise<MsgState> {
  const { t } = await getI18n();
  await requireTeacher();
  const url = str(f, "url");
  if (!/^https?:\/\//.test(url)) return { error: t("الرابط يجب أن يبدأ بـ https://") };
  const ltitle = str(f, "title") || t("رابط خارجي");
  await db.insert(schema.lessonFiles).values({ lessonId, kind: "link", title: ltitle, url, position: int(f, "position") });
  await notifyLesson(lessonId, "file", ltitle);
  revalidatePath(`/t/lessons/${lessonId}`);
  return { ok: t("تمت إضافة الرابط") };
}

const MAX_PDF = 20 * 1024 * 1024;

export async function uploadPdf(lessonId: number, _: MsgState, f: FormData): Promise<MsgState> {
  const { t } = await getI18n();
  await requireTeacher();
  const files = f.getAll("files").filter((x): x is File => x instanceof File && x.size > 0);
  if (!files.length) return { error: t("اختر ملفًا") };
  const allowDownload = f.get("allowDownload") === "on";
  let added = 0;
  for (const file of files) {
    const name = file.name.toLowerCase();
    if (name.endsWith(".ppt") || name.endsWith(".pptx")) {
      return { error: t("«{name}» ملف PowerPoint. احفظه أولًا كـ PDF من PowerPoint (ملف ← حفظ باسم ← PDF) ثم ارفعه.", { name: file.name }) };
    }
    const buf = await file.arrayBuffer();
    const head = new TextDecoder().decode(buf.slice(0, 5));
    if (head !== "%PDF-") return { error: t("«{name}» ليس ملف PDF", { name: file.name }) };
    if (file.size > MAX_PDF) return { error: t("«{name}» أكبر من 20 ميجابايت", { name: file.name }) };
    const key = newKey("pdf");
    await putFile(key, buf, "application/pdf");
    await db.insert(schema.lessonFiles).values({
      lessonId, kind: "pdf", title: file.name.replace(/\.pdf$/i, ""), storageKey: key, allowDownload, position: int(f, "position") + added,
    });
    added++;
  }
  if (added) await notifyLesson(lessonId, "file", added === 1 ? files[0].name.replace(/\.pdf$/i, "") : t("{n} ملفات", { n: added }));
  revalidatePath(`/t/lessons/${lessonId}`);
  return { ok: t("تم رفع {n} ملف", { n: added }) };
}

export async function updateFile(id: number, f: FormData) {
  await requireTeacher();
  const [file] = await db.update(schema.lessonFiles)
    .set({ title: str(f, "title"), position: int(f, "position"), allowDownload: f.get("allowDownload") === "on" })
    .where(eq(schema.lessonFiles.id, id)).returning();
  revalidatePath(`/t/lessons/${file.lessonId}`);
}

export async function deleteLessonFile(id: number) {
  await requireTeacher();
  const [file] = await db.delete(schema.lessonFiles).where(eq(schema.lessonFiles.id, id)).returning();
  if (file?.storageKey) await deleteFile(file.storageKey);
  if (file) revalidatePath(`/t/lessons/${file.lessonId}`);
}

// ---------- Announcements ----------

export async function createAnnouncement(f: FormData) {
  await requireTeacher();
  const body = str(f, "body");
  if (!body) return;
  const g = int(f, "grade");
  const grade = (await gradeIds()).includes(g) ? g : null;
  await db.insert(schema.announcements).values({ body, grade });
  await notifyStudents({ gradeId: grade }, "announcement", { text: body.length > 160 ? body.slice(0, 157) + "…" : body }, "/");
  revalidatePath("/t/announcements");
}

export async function toggleAnnouncement(id: number, active: boolean) {
  await requireTeacher();
  await db.update(schema.announcements).set({ active }).where(eq(schema.announcements.id, id));
  revalidatePath("/t/announcements");
}

export async function deleteAnnouncement(id: number) {
  await requireTeacher();
  await db.delete(schema.announcements).where(eq(schema.announcements.id, id));
  revalidatePath("/t/announcements");
}

// ---------- Settings ----------

export async function saveSettings(_: MsgState, f: FormData): Promise<MsgState> {
  const { t } = await getI18n();
  await requireTeacher();
  await db.update(schema.settings).set({
    teacherName: str(f, "teacherName") || t("الأستاذ"),
    platformName: str(f, "platformName") || "خوارزميات البسيوني في الرياضيات",
    whatsapp: str(f, "whatsapp"),
    graceDays: Math.max(0, int(f, "graceDays")),
    reminderDays: Math.max(0, int(f, "reminderDays")),
    monthlyFee: Math.max(0, int(f, "monthlyFee")),
    maxDevices: Math.min(Math.max(1, int(f, "maxDevices", 1)), 5),
  }).where(eq(schema.settings.id, 1));
  revalidatePath("/", "layout");
  return { ok: t("تم حفظ الإعدادات") };
}
