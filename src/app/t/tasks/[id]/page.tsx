import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { deleteTask, setTaskPublished } from "@/app/actions/tasks";
import { SubmitButton } from "@/components/client";
import { gradeMap, groupMap } from "@/lib/grades";
import { questionsOf, totalPoints } from "@/lib/tasks";
import { getI18n } from "@/i18n/server";
import { KIND_LABEL } from "@/lib/task-kinds";

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { t, dateTime } = await getI18n();
  const id = Number((await params).id);
  const [task] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, id));
  if (!task) notFound();
  const gradeLabel = await gradeMap();
  const groups = await groupMap();
  const qs = await questionsOf(id);
  const total = totalPoints(qs);
  const students = await db.select().from(schema.users).where(and(
    eq(schema.users.role, "student"), eq(schema.users.grade, task.gradeId),
    task.groupId ? eq(schema.users.groupId, task.groupId) : undefined,
  )).orderBy(asc(schema.users.fullName));
  const subs = await db.select().from(schema.taskSubmissions).where(eq(schema.taskSubmissions.taskId, id));
  const byStudent = new Map(subs.map((s) => [s.studentId, s]));
  // Students who submitted but have since moved grade/group still show
  const extra = subs.filter((s) => !students.some((u) => u.id === s.studentId)).map((s) => s.studentId);
  const others = extra.length ? await db.select().from(schema.users).where(or(...extra.map((x) => eq(schema.users.id, x)))) : [];
  const all = [...students, ...others];
  const now = new Date();
  const toMark = subs.filter((s) => !s.graded).length;
  const graded = subs.filter((s) => s.graded);
  const avg = graded.length ? Math.round((graded.reduce((n, s) => n + s.score, 0) / graded.length) * 10) / 10 : null;

  return (
    <>
      <div className="text-sm text-slate-500"><Link href="/t/tasks" className="underline">{t("المهام والواجبات")}</Link></div>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="h1 flex-1">{task.title}</h1>
        <Link href={`/t/tasks/${id}/edit`} className="btn-light">{t("تعديل")}</Link>
        <form action={setTaskPublished.bind(null, id, !task.published)}>
          <SubmitButton className={task.published ? "btn-light" : "btn-primary"}>{task.published ? t("إخفاء عن الطلاب") : t("نشر للطلاب")}</SubmitButton>
        </form>
        <form action={deleteTask.bind(null, id)}>
          <SubmitButton className="btn-danger" confirm={t("حذف المهمة وكل إجابات الطلاب عليها؟")}>{t("حذف")}</SubmitButton>
        </form>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <Info k={t("لمن")} v={`${t(gradeLabel[task.gradeId] ?? "—")}${task.groupId && groups.get(task.groupId) ? ` · ${t("مجموعة")} ${groups.get(task.groupId)!.name}` : ""}`} />
        <Info k={t("موعد التسليم")} v={dateTime(task.dueAt)} />
        <Info k={t("سلّم")} v={t("{a} من {b}", { a: subs.length, b: students.length })} />
        <Info k={t("متوسط الدرجات")} v={avg === null ? "—" : `${avg} / ${total}`} />
      </div>
      {!task.published && <p className="rounded-xl bg-slate-100 p-3 text-sm">{t("هذه المهمة مسودة ولا يراها الطلاب.")}</p>}
      {toMark > 0 && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{t("{n} تسليم ينتظر تصحيحك.", { n: toMark })}</p>}

      <section className="card overflow-x-auto p-0">
        <table className="tbl">
          <thead><tr><th>{t("الطالب")}</th><th>{t("الحالة")}</th><th>{t("وقت التسليم")}</th><th>{t("الدرجة")}</th><th></th></tr></thead>
          <tbody>
            {all.map((u) => {
              const s = byStudent.get(u.id);
              return (
                <tr key={u.id}>
                  <td><Link href={`/t/students/${u.id}`} className="font-semibold text-blue-800 hover:underline">{u.fullName}</Link></td>
                  <td>{s ? (s.graded
                    ? <span className="badge bg-emerald-100 text-emerald-800">{t("مُصحَّح")}</span>
                    : <span className="badge bg-amber-100 text-amber-800">{t("يحتاج تصحيح")}</span>)
                    : task.dueAt > now ? <span className="badge bg-slate-100 text-slate-600">{t("لم يسلّم بعد")}</span>
                    : <span className="badge bg-red-100 text-red-700">{t("لم يسلّم")}</span>}
                    {s?.late && <span className="badge ms-1 bg-orange-100 text-orange-800">{t("متأخر")}</span>}</td>
                  <td className="whitespace-nowrap">{s ? dateTime(s.submittedAt) : "—"}</td>
                  <td className="whitespace-nowrap">{s ? `${s.score} / ${total}` : "—"}</td>
                  <td>{s && <Link href={`/t/tasks/${id}/s/${s.id}`} className="btn-light whitespace-nowrap">{s.graded ? t("عرض") : t("تصحيح")}</Link>}</td>
                </tr>
              );
            })}
            {!all.length && <tr><td colSpan={5} className="py-6 text-center text-slate-500">{t("لا يوجد طلاب في هذا الصف أو المجموعة")}</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="card space-y-2">
        <h2 className="font-bold">{t("الأسئلة")} <span className="muted">({t("المجموع {p} درجة", { p: total })})</span></h2>
        <ol className="list-decimal space-y-1 ps-5 text-sm">
          {qs.map((q) => <li key={q.id}><span className="text-slate-500">[{t(KIND_LABEL[q.kind])} · {q.points}]</span> {q.prompt}</li>)}
        </ol>
      </section>
    </>
  );
}

function Info({ k, v }: { k: string; v: string }) {
  return <div className="card"><div className="muted text-xs">{k}</div><div className="font-semibold">{v}</div></div>;
}
