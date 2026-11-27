import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { gradeSubmission } from "@/app/actions/tasks";
import { SubmitButton } from "@/components/client";
import AnswerView from "@/components/answer-view";
import { questionsOf, totalPoints } from "@/lib/tasks";
import { getI18n } from "@/i18n/server";

export default async function ReviewSubmission({ params }: { params: Promise<{ id: string; sid: string }> }) {
  const { t, dateTime } = await getI18n();
  const p = await params;
  const id = Number(p.id), sid = Number(p.sid);
  const [row] = await db.select({ s: schema.taskSubmissions, u: schema.users, task: schema.tasks }).from(schema.taskSubmissions)
    .innerJoin(schema.users, eq(schema.users.id, schema.taskSubmissions.studentId))
    .innerJoin(schema.tasks, eq(schema.tasks.id, schema.taskSubmissions.taskId))
    .where(eq(schema.taskSubmissions.id, sid));
  if (!row || row.task.id !== id) notFound();
  const qs = await questionsOf(id);
  const answers = await db.select().from(schema.taskAnswers).where(eq(schema.taskAnswers.submissionId, sid));
  const files = answers.length ? await db.select().from(schema.answerFiles).where(inArray(schema.answerFiles.answerId, answers.map((a) => a.id))) : [];
  const byQ = new Map(answers.map((a) => [a.questionId, a]));
  // Next/previous submission of the same task, waiting ones first
  const subs = await db.select({ id: schema.taskSubmissions.id, graded: schema.taskSubmissions.graded }).from(schema.taskSubmissions)
    .where(eq(schema.taskSubmissions.taskId, id));
  const nextPending = subs.find((x) => !x.graded && x.id !== sid);

  return (
    <>
      <div className="text-sm text-slate-500">
        <Link href="/t/tasks" className="underline">{t("المهام والواجبات")}</Link> / <Link href={`/t/tasks/${id}`} className="underline">{row.task.title}</Link>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="h1 flex-1">{row.u.fullName}</h1>
        <span className="badge bg-slate-100 text-slate-700">{t("سلّم في")} {dateTime(row.s.submittedAt)}</span>
        {row.s.late && <span className="badge bg-orange-100 text-orange-800">{t("متأخر")}</span>}
        <span className="badge bg-blue-100 text-blue-800">{row.s.score} / {totalPoints(qs)}</span>
      </div>
      <form action={gradeSubmission.bind(null, sid)} className="space-y-3">
        {qs.map((q, i) => {
          const a = byQ.get(q.id);
          return (
            <AnswerView key={q.id} q={q} a={a} index={i + 1} reveal t={t}
              files={files.filter((f) => f.answerId === a?.id)}>
              {a && (
                <div className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-2">
                  <label className="text-sm">{t("الدرجة")}
                    <input name={`points_${a.id}`} type="number" min={0} max={q.points} defaultValue={a.points ?? ""} className="input mt-1 w-24"
                      placeholder={`0 - ${q.points}`} />
                  </label>
                  <label className="min-w-48 flex-1 text-sm">{t("ملاحظة للطالب (اختياري)")}
                    <input name={`comment_${a.id}`} defaultValue={a.comment ?? ""} className="input mt-1" />
                  </label>
                </div>
              )}
            </AnswerView>
          );
        })}
        <section className="card space-y-2">
          <label className="label">{t("تعليق عام للطالب (اختياري)")}</label>
          <textarea name="feedback" defaultValue={row.s.feedback ?? ""} className="input min-h-20" />
          <div className="flex flex-wrap gap-2">
            <SubmitButton>{t("حفظ التصحيح")}</SubmitButton>
            {nextPending && <Link href={`/t/tasks/${id}/s/${nextPending.id}`} className="btn-light">{t("التسليم التالي الذي يحتاج تصحيح ←")}</Link>}
          </div>
          <p className="muted text-xs">{t("الأسئلة الموضوعية مصححة تلقائيًا، ويمكنك تغيير درجتها.")}</p>
        </section>
      </form>
    </>
  );
}
