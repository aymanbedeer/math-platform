import "server-only";
import { and, asc, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { db, schema } from "@/db";
import type { QuestionKind } from "@/db/schema";

/** Questions marked automatically. Short answers are too, when the teacher gave accepted answers. */
export const autoKinds: QuestionKind[] = ["single", "multi", "truefalse"];

const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase()
  .replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي")
  .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

/** Points for an answer, or null when the teacher must mark it. */
export function autoPoints(q: schema.TaskQuestion, value: (number | string)[] | null): number | null {
  const correct = q.correct ?? [];
  const v = value ?? [];
  switch (q.kind) {
    case "single":
    case "truefalse":
      return v.length === 1 && correct.includes(v[0]) ? q.points : 0;
    case "multi": {
      const a = [...v].map(Number).sort().join(","), b = [...correct].map(Number).sort().join(",");
      return a === b && a !== "" ? q.points : 0;
    }
    case "short":
      if (!correct.length) return null;
      return v.length && correct.some((c) => norm(String(c)) === norm(String(v[0]))) ? q.points : 0;
    default:
      return null;
  }
}

/** Published tasks a student can see: their grade, and either the whole grade or their group. */
export async function tasksForStudent(st: schema.User) {
  return db.select().from(schema.tasks).where(and(
    eq(schema.tasks.published, true),
    eq(schema.tasks.gradeId, st.grade ?? 0),
    st.groupId ? or(isNull(schema.tasks.groupId), eq(schema.tasks.groupId, st.groupId)) : isNull(schema.tasks.groupId),
  )).orderBy(asc(schema.tasks.dueAt));
}

export async function questionsOf(taskId: number) {
  return db.select().from(schema.taskQuestions).where(eq(schema.taskQuestions.taskId, taskId))
    .orderBy(asc(schema.taskQuestions.position), asc(schema.taskQuestions.id));
}

export async function submissionsByStudent(studentId: number, taskIds: number[]) {
  if (!taskIds.length) return new Map<number, schema.TaskSubmissionRow>();
  const rows = await db.select().from(schema.taskSubmissions)
    .where(and(eq(schema.taskSubmissions.studentId, studentId), inArray(schema.taskSubmissions.taskId, taskIds)))
    .orderBy(desc(schema.taskSubmissions.submittedAt));
  return new Map(rows.map((r) => [r.taskId, r]));
}

export type TaskState = "open" | "submitted" | "graded" | "missed" | "late_open";

export function taskState(task: schema.Task, sub: schema.TaskSubmissionRow | undefined, now = new Date()): TaskState {
  if (sub) return sub.graded ? "graded" : "submitted";
  if (task.dueAt > now) return "open";
  return task.allowLate ? "late_open" : "missed";
}

export const totalPoints = (qs: schema.TaskQuestion[]) => qs.reduce((n, q) => n + q.points, 0);

/** Recompute a submission's score and whether every answer has been marked. */
export async function refreshScore(submissionId: number) {
  const answers = await db.select({ points: schema.taskAnswers.points }).from(schema.taskAnswers)
    .where(eq(schema.taskAnswers.submissionId, submissionId));
  const graded = answers.every((a) => a.points !== null);
  const score = answers.reduce((n, a) => n + (a.points ?? 0), 0);
  await db.update(schema.taskSubmissions).set({ score, graded, gradedAt: graded ? new Date() : null })
    .where(eq(schema.taskSubmissions.id, submissionId));
}

/** File types a student may upload as an answer. Everything is served back as a download. */
export const ANSWER_EXT = ["pdf", "jpg", "jpeg", "png", "webp", "heic", "heif", "gif", "doc", "docx", "xls", "xlsx",
  "ppt", "pptx", "odt", "ods", "odp", "rtf", "txt", "zip"];
export const MAX_SUBMISSION_BYTES = 5 * 1024 * 1024; // keeps one request under the host's body limit
