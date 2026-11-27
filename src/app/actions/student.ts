"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireStudent } from "@/lib/auth";
import { lessonForStudent } from "@/lib/content";

export async function setCompleted(lessonId: number, done: boolean) {
  const { user, canViewPaid } = await requireStudent();
  if (!(await lessonForStudent(lessonId, user, canViewPaid))) return;
  if (done) {
    await db.insert(schema.completions).values({ studentId: user.id, lessonId }).onConflictDoNothing();
  } else {
    await db.delete(schema.completions).where(and(eq(schema.completions.studentId, user.id), eq(schema.completions.lessonId, lessonId)));
  }
  revalidatePath(`/lessons/${lessonId}`);
  revalidatePath("/lessons");
}
