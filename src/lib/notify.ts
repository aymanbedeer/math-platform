import { and, eq, inArray, isNull, desc, count } from "drizzle-orm";
import { db, schema } from "@/db";
import type { NotificationKind } from "@/db/schema";

type Params = Record<string, string | number>;

/** Arabic template for each kind; English comes from the i18n dictionary. */
export const NOTIFY_TEXT: Record<NotificationKind, { title: string; body: string; icon: string }> = {
  task: { title: "مهمة جديدة", body: "«{title}» · التسليم {due}", icon: "✎" },
  lesson: { title: "درس جديد", body: "«{title}»", icon: "▤" },
  file: { title: "ملف جديد في درس", body: "«{file}» في درس «{title}»", icon: "📎" },
  announcement: { title: "إعلان من الأستاذ", body: "{text}", icon: "📢" },
  graded: { title: "تم تصحيح مهمتك", body: "«{title}» · درجتك {score} من {total}", icon: "✓" },
  submitted: { title: "تسليم جديد", body: "{name} سلّم «{title}»", icon: "📥" },
};

async function insertFor(userIds: number[], kind: NotificationKind, params: Params, link: string | null) {
  if (!userIds.length) return;
  await db.insert(schema.notifications).values(userIds.map((userId) => ({ userId, kind, params, link })));
}

/** All students of a grade (or one group in it); gradeId null means every student. */
export async function notifyStudents(target: { gradeId: number | null; groupId?: number | null }, kind: NotificationKind, params: Params, link: string | null) {
  const conds = [eq(schema.users.role, "student" as const)];
  if (target.gradeId) conds.push(eq(schema.users.grade, target.gradeId));
  if (target.groupId) conds.push(eq(schema.users.groupId, target.groupId));
  const rows = await db.select({ id: schema.users.id }).from(schema.users).where(and(...conds));
  await insertFor(rows.map((r) => r.id), kind, params, link);
}

export async function notifyUser(userId: number, kind: NotificationKind, params: Params, link: string | null) {
  await insertFor([userId], kind, params, link);
}

export async function notifyTeachers(kind: NotificationKind, params: Params, link: string | null) {
  const rows = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.role, "teacher"));
  await insertFor(rows.map((r) => r.id), kind, params, link);
}

export async function unreadCount(userId: number) {
  const [r] = await db.select({ n: count() }).from(schema.notifications)
    .where(and(eq(schema.notifications.userId, userId), isNull(schema.notifications.readAt)));
  return r?.n ?? 0;
}

export async function listNotifications(userId: number, limit = 100) {
  return db.select().from(schema.notifications).where(eq(schema.notifications.userId, userId))
    .orderBy(desc(schema.notifications.createdAt), desc(schema.notifications.id)).limit(limit);
}

export async function markRead(userId: number, ids?: number[]) {
  const conds = [eq(schema.notifications.userId, userId), isNull(schema.notifications.readAt)];
  if (ids?.length) conds.push(inArray(schema.notifications.id, ids));
  await db.update(schema.notifications).set({ readAt: new Date() }).where(and(...conds));
}
