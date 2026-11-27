import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { submitTask } from "@/app/actions/tasks";
import AnswerView from "@/components/answer-view";
import { requireStudent } from "@/lib/auth";
import { questionsOf, taskState, tasksForStudent, totalPoints } from "@/lib/tasks";
import { getI18n } from "@/i18n/server";
import AnswerForm from "./form";

export default async function StudentTask({ params }: { params: Promise<{ id: string }> }) {
  const { t, dateTime } = await getI18n();
  const id = Number((await params).id);
  const { user, canViewPaid } = await requireStudent();
  if (!canViewPaid) redirect("/");
  const task = (await tasksForStudent(user)).find((x) => x.id === id);
  if (!task) notFound();
  const qs = await questionsOf(id);
  const [sub] = await db.select().from(schema.taskSubmissions)
    .where(and(eq(schema.taskSubmissions.taskId, id), eq(schema.taskSubmissions.studentId, user.id)));
  const state = taskState(task, sub);
  const total = totalPoints(qs);

  let body: React.ReactNode;
  if (sub) {
    const answers = await db.select().from(schema.taskAnswers).where(eq(schema.taskAnswers.submissionId, sub.id));
    const files = answers.length ? await db.select().from(schema.answerFiles).where(inArray(schema.answerFiles.answerId, answers.map((a) => a.id))) : [];
    const byQ = new Map(answers.map((a) => [a.questionId, a]));
    const reveal = task.showAnswers && task.dueAt <= new Date();
    body = (
      <>
        <div className={`card ${sub.graded ? "border-blue-200 bg-blue-50" : "border-amber-200 bg-amber-50"}`}>
          {sub.graded
            ? <p className="text-lg font-bold text-blue-900">{t("درجتك: {s} من {p}", { s: sub.score, p: total })}</p>
            : <p className="font-semibold text-amber-900">{t("تم التسليم. بعض الإجابات بانتظار تصحيح الأستاذ.")}</p>}
          <p className="muted text-sm">{t("سلّمت في")} {dateTime(sub.submittedAt)}{sub.late ? ` · ${t("متأخر")}` : ""}</p>
          {sub.feedback && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-white p-3 text-sm">💬 {sub.feedback}</p>}
          {!reveal && task.showAnswers && <p className="muted mt-1 text-xs">{t("تظهر الإجابات الصحيحة بعد موعد التسليم.")}</p>}
        </div>
        {qs.map((q, i) => {
          const a = byQ.get(q.id);
          return <AnswerView key={q.id} q={q} a={a} index={i + 1} reveal={reveal} t={t} files={files.filter((f) => f.answerId === a?.id)} />;
        })}
      </>
    );
  } else if (state === "missed") {
    body = <p className="card text-center text-slate-600">{t("انتهى موعد التسليم ولم تُسلَّم هذه المهمة.")}</p>;
  } else {
    body = (
      <AnswerForm action={submitTask.bind(null, id)}
        questions={qs.map((q) => ({ id: q.id, kind: q.kind, prompt: q.prompt, options: q.options ?? [], points: q.points }))} />
    );
  }

  return (
    <>
      <div className="text-sm text-slate-500"><Link href="/tasks" className="underline">{t("المهام")}</Link></div>
      <h1 className="h1">{task.title}</h1>
      <div className="flex flex-wrap gap-2 text-sm">
        <span className="badge bg-slate-100 text-slate-700">{t("التسليم:")} {dateTime(task.dueAt)}</span>
        <span className="badge bg-slate-100 text-slate-700">{t("{n} سؤال · {p} درجة", { n: qs.length, p: total })}</span>
        {state === "late_open" && <span className="badge bg-orange-100 text-orange-800">{t("انتهى الموعد، والتسليم الآن يُسجَّل متأخرًا")}</span>}
      </div>
      {task.instructions && <p className="whitespace-pre-wrap text-slate-700">{task.instructions}</p>}
      {body}
    </>
  );
}
