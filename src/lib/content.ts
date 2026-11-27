import "server-only";
import { and, asc, eq, inArray, isNull, lte, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { today } from "./dates";

type Student = Pick<schema.User, "id" | "grade">;

function visibleUnits(grade: number) {
  return and(eq(schema.units.grade, grade), or(isNull(schema.units.visibleFrom), lte(schema.units.visibleFrom, today())));
}

/** Units and lessons the student may see. When locked, only free lessons. */
export async function studentCatalog(st: Student, canViewPaid: boolean) {
  const units = await db.select().from(schema.units).where(visibleUnits(st.grade ?? 0))
    .orderBy(asc(schema.units.position), asc(schema.units.id));
  if (!units.length) return { units: [], lessons: [], done: new Set<number>() };
  const statuses: ("published" | "free")[] = canViewPaid ? ["published", "free"] : ["free"];
  const lessons = await db.select().from(schema.lessons)
    .where(and(inArray(schema.lessons.unitId, units.map((u) => u.id)), inArray(schema.lessons.status, statuses)))
    .orderBy(asc(schema.lessons.position), asc(schema.lessons.id));
  const done = new Set((await db.select({ id: schema.completions.lessonId }).from(schema.completions)
    .where(eq(schema.completions.studentId, st.id))).map((r) => r.id));
  return { units: units.filter((u) => lessons.some((l) => l.unitId === u.id)), lessons, done };
}

/** The lesson if this student may open it, else null. */
export async function lessonForStudent(lessonId: number, st: Student, canViewPaid: boolean) {
  const [row] = await db.select({ l: schema.lessons, u: schema.units }).from(schema.lessons)
    .innerJoin(schema.units, eq(schema.units.id, schema.lessons.unitId))
    .where(and(eq(schema.lessons.id, lessonId), visibleUnits(st.grade ?? 0)));
  if (!row) return null;
  if (row.l.status === "draft") return null;
  if (row.l.status !== "free" && !canViewPaid) return null;
  return row;
}
