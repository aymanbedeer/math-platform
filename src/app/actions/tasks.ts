"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { questionKinds, type QuestionKind } from "@/db/schema";
import { requireStudent, requireTeacher } from "@/lib/auth";
import { ANSWER_EXT, MAX_SUBMISSION_BYTES, autoPoints, questionsOf, refreshScore, taskState, tasksForStudent } from "@/lib/tasks";
import { newKey, putFile } from "@/lib/storage";
import { getI18n } from "@/i18n/server";
import { notifyStudents, notifyTeachers, notifyUser } from "@/lib/notify";

export type TaskMsg = { error?: string; ok?: string } | undefined;

type QIn = { kind: QuestionKind; prompt: string; options?: string[]; correct?: (number | string)[]; points?: number };
type TaskIn = {
  title: string; instructions?: string; gradeId: number; groupId?: number | null; dueAt: string;
  allowLate?: boolean; showAnswers?: boolean; published?: boolean; questions: QIn[];
};

/** Validates the editor's JSON. Returns an Arabic error key or the cleaned task. */
function clean(raw: unknown): { error: string } | { task: TaskIn } {
  const d = raw as TaskIn;
  if (!d || typeof d.title !== "string" || !d.title.trim()) return { error: "اكتب عنوان المهمة" };
  const due = new Date(d.dueAt);
  if (Number.isNaN(due.getTime())) return { error: "اختر موعد التسليم" };
  if (!Array.isArray(d.questions) || !d.questions.length) return { error: "أضف سؤالًا واحدًا على الأقل" };
  const questions: QIn[] = [];
  for (const q of d.questions.slice(0, 100)) {
    if (!questionKinds.includes(q.kind)) return { error: "نوع سؤال غير معروف" };
    const prompt = String(q.prompt ?? "").trim();
    if (!prompt) return { error: "اكتب نص كل سؤال" };
    const points = Math.min(Math.max(Math.round(Number(q.points) || 0), 0), 100);
    let options: string[] | undefined, correct: (number | string)[] = [];
    if (q.kind === "single" || q.kind === "multi") {
      options = (q.options ?? []).map((o) => String(o).trim()).filter(Boolean).slice(0, 10);
      if (options.length < 2) return { error: "سؤال الاختيار يحتاج اختيارين على الأقل" };
      correct = (q.correct ?? []).map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < options!.length);
      if (!correct.length) return { error: "حدّد الإجابة الصحيحة لكل سؤال اختيار" };
      if (q.kind === "single") correct = correct.slice(0, 1);
    } else if (q.kind === "truefalse") {
      const c = Number((q.correct ?? [])[0]);
      if (c !== 0 && c !== 1) return { error: "حدّد إن كانت العبارة صحيحة أم خطأ" };
      correct = [c];
    } else if (q.kind === "short") {
      correct = (q.correct ?? []).map((x) => String(x).trim()).filter(Boolean).slice(0, 10);
    }
    questions.push({ kind: q.kind, prompt: prompt.slice(0, 4000), options, correct, points });
  }
  return { task: {
    title: d.title.trim().slice(0, 200), instructions: String(d.instructions ?? "").trim().slice(0, 4000),
    gradeId: Number(d.gradeId), groupId: d.groupId ? Number(d.groupId) : null, dueAt: due.toISOString(),
    allowLate: !!d.allowLate, showAnswers: d.showAnswers !== false, published: !!d.published, questions,
  } };
}

/** Create or update a task. Questions can't change once a student has submitted. */
export async function saveTask(taskId: number | null, _: TaskMsg, f: FormData): Promise<TaskMsg> {
  const { t } = await getI18n();
  await requireTeacher();
  let raw: unknown;
  try { raw = JSON.parse(String(f.get("data") ?? "")); } catch { return { error: t("تعذّر حفظ المهمة") }; }
  const r = clean(raw);
  if ("error" in r) return { error: t(r.error) };
  const d = r.task;
  const mode = f.get("mode");
  if (mode) d.published = mode === "publish";
  const [grade] = await db.select().from(schema.grades).where(eq(schema.grades.id, d.gradeId));
  if (!grade) return { error: t("اختر الصف") };
  if (d.groupId) {
    const [g] = await db.select().from(schema.groups).where(and(eq(schema.groups.id, d.groupId), eq(schema.groups.gradeId, d.gradeId)));
    if (!g) d.groupId = null;
  }
  const values = {
    title: d.title, instructions: d.instructions || null, gradeId: d.gradeId, groupId: d.groupId ?? null,
    dueAt: new Date(d.dueAt), allowLate: !!d.allowLate, showAnswers: !!d.showAnswers, published: !!d.published,
  };
  let id = taskId;
  const wasPublished = taskId ? (await db.select({ p: schema.tasks.published }).from(schema.tasks).where(eq(schema.tasks.id, taskId)))[0]?.p : false;
  await db.transaction(async (tx) => {
    if (id) {
      await tx.update(schema.tasks).set(values).where(eq(schema.tasks.id, id));
      const [hasSub] = await tx.select({ id: schema.taskSubmissions.id }).from(schema.taskSubmissions)
        .where(eq(schema.taskSubmissions.taskId, id)).limit(1);
      if (hasSub) return; // keep questions as they are
      await tx.delete(schema.taskQuestions).where(eq(schema.taskQuestions.taskId, id));
    } else {
      [{ id }] = await tx.insert(schema.tasks).values(values).returning({ id: schema.tasks.id });
    }
    await tx.insert(schema.taskQuestions).values(d.questions.map((q, i) => ({
      taskId: id!, position: i, kind: q.kind, prompt: q.prompt, options: q.options ?? null, correct: q.correct ?? null, points: q.points ?? 1,
    })));
  });
  if (values.published && !wasPublished) await announceTask(id!);
  revalidatePath("/t/tasks");
  revalidatePath("/tasks");
  redirect(`/t/tasks/${id}`);
}

/** Tells the task's students that a new task is waiting for them. */
async function announceTask(id: number) {
  const [task] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, id));
  if (!task) return;
  await notifyStudents({ gradeId: task.gradeId, groupId: task.groupId }, "task", { title: task.title, due: task.dueAt.toISOString() }, `/tasks/${id}`);
}

export async function setTaskPublished(id: number, published: boolean) {
  await requireTeacher();
  const [prev] = await db.select({ p: schema.tasks.published }).from(schema.tasks).where(eq(schema.tasks.id, id));
  await db.update(schema.tasks).set({ published }).where(eq(schema.tasks.id, id));
  if (published && prev && !prev.p) await announceTask(id);
  revalidatePath("/t/tasks", "layout");
  revalidatePath("/tasks", "layout");
}

export async function deleteTask(id: number) {
  await requireTeacher();
  await db.delete(schema.tasks).where(eq(schema.tasks.id, id));
  revalidatePath("/t/tasks");
  redirect("/t/tasks");
}

/** Teacher marks the answers that need it, can override automatic marks, and leaves feedback. */
export async function gradeSubmission(submissionId: number, f: FormData) {
  await requireTeacher();
  const [sub] = await db.select().from(schema.taskSubmissions).where(eq(schema.taskSubmissions.id, submissionId));
  if (!sub) return;
  const rows = await db.select({ a: schema.taskAnswers, q: schema.taskQuestions }).from(schema.taskAnswers)
    .innerJoin(schema.taskQuestions, eq(schema.taskQuestions.id, schema.taskAnswers.questionId))
    .where(eq(schema.taskAnswers.submissionId, submissionId));
  for (const { a, q } of rows) {
    const raw = String(f.get(`points_${a.id}`) ?? "").trim();
    const points = raw === "" ? a.points : Math.min(Math.max(Math.round(Number(raw) || 0), 0), q.points);
    const comment = String(f.get(`comment_${a.id}`) ?? "").trim().slice(0, 2000) || null;
    await db.update(schema.taskAnswers).set({ points, comment }).where(eq(schema.taskAnswers.id, a.id));
  }
  await db.update(schema.taskSubmissions).set({ feedback: String(f.get("feedback") ?? "").trim().slice(0, 4000) || null })
    .where(eq(schema.taskSubmissions.id, submissionId));
  await refreshScore(submissionId);
  const [after] = await db.select().from(schema.taskSubmissions).where(eq(schema.taskSubmissions.id, submissionId));
  if (after?.graded) {
    const [task] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, sub.taskId));
    const total = (await questionsOf(sub.taskId)).reduce((n, q) => n + q.points, 0);
    await notifyUser(sub.studentId, "graded", { title: task?.title ?? "", score: after.score ?? 0, total }, `/tasks/${sub.taskId}`);
  }
  revalidatePath(`/t/tasks/${sub.taskId}`, "layout");
  revalidatePath("/tasks", "layout");
}

/** A student hands in a task once. Files are stored first, then everything is saved together. */
export async function submitTask(taskId: number, _: TaskMsg, f: FormData): Promise<TaskMsg> {
  const { t } = await getI18n();
  const { user, canViewPaid } = await requireStudent();
  if (!canViewPaid) return { error: t("اشتراكك متوقف. تواصل مع الأستاذ.") };
  const task = (await tasksForStudent(user)).find((x) => x.id === taskId);
  if (!task) return { error: t("هذه المهمة غير متاحة") };
  const [existing] = await db.select().from(schema.taskSubmissions)
    .where(and(eq(schema.taskSubmissions.taskId, taskId), eq(schema.taskSubmissions.studentId, user.id)));
  const state = taskState(task, existing);
  if (state !== "open" && state !== "late_open") return { error: t("انتهى موعد التسليم") };

  const questions = await questionsOf(taskId);
  const files = new Map<number, File[]>();
  let total = 0;
  for (const q of questions.filter((x) => x.kind === "file")) {
    const list = f.getAll(`f_${q.id}`).filter((x): x is File => x instanceof File && x.size > 0).slice(0, 10);
    for (const file of list) {
      const ext = (file.name.split(".").pop() || "").toLowerCase();
      if (!ANSWER_EXT.includes(ext)) return { error: t("نوع الملف «{name}» غير مسموح", { name: file.name }) };
      total += file.size;
    }
    files.set(q.id, list);
  }
  if (total > MAX_SUBMISSION_BYTES) return { error: t("حجم الملفات أكبر من 5 ميجابايت. صغّر الصور أو قسّم الملفات.") };

  const stored = new Map<number, { key: string; name: string; mime: string; size: number }[]>();
  for (const [qid, list] of files) {
    const out = [];
    for (const file of list) {
      const ext = (file.name.split(".").pop() || "bin").toLowerCase();
      const key = `answers/${newKey(ext)}`;
      await putFile(key, await file.arrayBuffer(), file.type || "application/octet-stream");
      out.push({ key, name: file.name.slice(0, 200), mime: file.type || "application/octet-stream", size: file.size });
    }
    stored.set(qid, out);
  }

  const late = task.dueAt <= new Date();
  const subId = await db.transaction(async (tx) => {
    const [sub] = await tx.insert(schema.taskSubmissions).values({ taskId, studentId: user.id, late }).returning();
    for (const q of questions) {
      let value: (number | string)[] | null = null;
      if (q.kind === "single" || q.kind === "truefalse") {
        const v = f.get(`q_${q.id}`);
        value = v === null || v === "" ? [] : [Number(v)];
      } else if (q.kind === "multi") {
        value = f.getAll(`q_${q.id}`).map(Number).filter(Number.isInteger);
      } else if (q.kind === "short" || q.kind === "essay") {
        const v = String(f.get(`q_${q.id}`) ?? "").trim().slice(0, 20000);
        value = v ? [v] : [];
      }
      const ups = stored.get(q.id) ?? [];
      // An empty answer to a manual question gets 0 straight away
      const empty = (q.kind === "file" && !ups.length) || ((q.kind === "essay") && !value?.length);
      const points = empty ? 0 : autoPoints(q, value);
      const [a] = await tx.insert(schema.taskAnswers).values({ submissionId: sub.id, questionId: q.id, value, points }).returning();
      if (ups.length) {
        await tx.insert(schema.answerFiles).values(ups.map((u) => ({ answerId: a.id, storageKey: u.key, name: u.name, mime: u.mime, size: u.size })));
      }
    }
    return sub.id;
  });
  await refreshScore(subId);
  await notifyTeachers("submitted", { name: user.fullName, title: task.title }, `/t/tasks/${taskId}/s/${subId}`);
  revalidatePath("/tasks", "layout");
  revalidatePath("/t", "layout");
  redirect(`/tasks/${taskId}`);
}
