import "server-only";
import { cache } from "react";
import { asc } from "drizzle-orm";
import { db, schema } from "@/db";

export type Grade = { id: number; name: string };

/** All grades in display order. Names are Arabic; pass them through t() to show the English name of the built-in ones. */
export const getGrades = cache(async (): Promise<Grade[]> =>
  db.select({ id: schema.grades.id, name: schema.grades.name }).from(schema.grades)
    .orderBy(asc(schema.grades.position), asc(schema.grades.id)));

/** id -> name lookup. */
export const gradeMap = cache(async (): Promise<Record<number, string>> =>
  Object.fromEntries((await getGrades()).map((g) => [g.id, g.name])));

export type Group = { id: number; name: string; gradeId: number };

/** All groups, ordered by grade and then naturally by name ("2" before "10"). */
export const getGroups = cache(async (): Promise<Group[]> => {
  const order = new Map((await getGrades()).map((g, i) => [g.id, i]));
  const rows = await db.select({ id: schema.groups.id, name: schema.groups.name, gradeId: schema.groups.gradeId }).from(schema.groups);
  return rows.sort((a, b) => (order.get(a.gradeId) ?? 0) - (order.get(b.gradeId) ?? 0)
    || a.name.localeCompare(b.name, "ar", { numeric: true }));
});

/** id -> group lookup. */
export const groupMap = cache(async () => new Map((await getGroups()).map((g) => [g.id, g])));
