"use server";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireTeacher } from "@/lib/auth";
import { getI18n } from "@/i18n/server";

export type ClassMsg = { error?: string; ok?: string } | undefined;
const name = (f: FormData) => String(f.get("name") ?? "").trim().slice(0, 60);
const done = () => revalidatePath("/t", "layout");

export async function addGrade(_: ClassMsg, f: FormData): Promise<ClassMsg> {
  const { t } = await getI18n();
  await requireTeacher();
  const n = name(f);
  if (!n) return { error: t("اكتب اسم الصف") };
  const [{ max }] = await db.select({ max: sql<number>`coalesce(max(${schema.grades.position}), 0)` }).from(schema.grades);
  await db.insert(schema.grades).values({ name: n, position: Number(max) + 1 });
  done();
  return { ok: t("تمت إضافة {name}", { name: n }) };
}

export async function renameGrade(id: number, f: FormData) {
  await requireTeacher();
  const n = name(f);
  if (n) await db.update(schema.grades).set({ name: n }).where(eq(schema.grades.id, id));
  done();
}

/** Only removes a grade that no student, unit or announcement uses. */
export async function deleteGrade(id: number) {
  await requireTeacher();
  const [{ n }] = await db.select({
    n: sql<number>`(select count(*) from users where grade = ${id}) + (select count(*) from units where grade = ${id}) + (select count(*) from announcements where grade = ${id})`,
  }).from(schema.grades).where(eq(schema.grades.id, id));
  if (Number(n) === 0) await db.delete(schema.grades).where(eq(schema.grades.id, id));
  done();
}

export async function addGroup(_: ClassMsg, f: FormData): Promise<ClassMsg> {
  const { t } = await getI18n();
  await requireTeacher();
  const n = name(f);
  const gradeId = parseInt(String(f.get("gradeId")), 10);
  if (!n) return { error: t("اكتب اسم المجموعة أو رقمها") };
  const [g] = await db.select().from(schema.grades).where(eq(schema.grades.id, gradeId));
  if (!g) return { error: t("اختر الصف") };
  const [exists] = await db.select().from(schema.groups).where(and(eq(schema.groups.gradeId, gradeId), eq(schema.groups.name, n)));
  if (exists) return { error: t("المجموعة {name} موجودة بالفعل في هذا الصف", { name: n }) };
  await db.insert(schema.groups).values({ name: n, gradeId });
  done();
  return { ok: t("تمت إضافة {name}", { name: n }) };
}

export async function renameGroup(id: number, f: FormData) {
  await requireTeacher();
  const n = name(f);
  const [g] = await db.select().from(schema.groups).where(eq(schema.groups.id, id));
  if (!g || !n || n === g.name) return;
  const [clash] = await db.select().from(schema.groups).where(and(eq(schema.groups.gradeId, g.gradeId), eq(schema.groups.name, n)));
  if (clash) return;
  await db.update(schema.groups).set({ name: n }).where(eq(schema.groups.id, id));
  done();
}

/** Deleting a group leaves its students without a group (the foreign key sets it to null). */
export async function deleteGroup(id: number) {
  await requireTeacher();
  await db.delete(schema.groups).where(eq(schema.groups.id, id));
  done();
}
