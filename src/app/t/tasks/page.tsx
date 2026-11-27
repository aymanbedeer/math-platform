import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { getI18n } from "@/i18n/server";
import { gradeMap, groupMap } from "@/lib/grades";

export default async function Tasks() {
  const { t, dateTime } = await getI18n();
  const gradeLabel = await gradeMap();
  const groups = await groupMap();
  const rows = await db.select({
    task: schema.tasks,
    questions: sql<number>`(select count(*) from task_questions q where q.task_id = "tasks"."id")`,
    submitted: sql<number>`(select count(*) from task_submissions s where s.task_id = "tasks"."id")`,
    toMark: sql<number>`(select count(*) from task_submissions s where s.task_id = "tasks"."id" and not s.graded)`,
    students: sql<number>`(select count(*) from users u where u.role = 'student' and u.grade = "tasks"."grade_id" and ("tasks"."group_id" is null or u.group_id = "tasks"."group_id"))`,
  }).from(schema.tasks).orderBy(desc(schema.tasks.dueAt));
  const now = new Date();

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="h1 flex-1">{t("المهام والواجبات")}</h1>
        <Link href="/t/tasks/new" className="btn-primary">{t("+ مهمة جديدة")}</Link>
      </div>
      <p className="muted">{t("أنشئ مهمة لصف أو مجموعة بموعد تسليم، بأي نوع من الأسئلة: اختيار من متعدد، صح وخطأ، إجابة قصيرة، مقالي، أو رفع ملف للواجب.")}</p>
      <div className="space-y-3">
        {rows.map(({ task, questions, submitted, toMark, students }) => (
          <Link key={task.id} href={`/t/tasks/${task.id}`} className="card block space-y-1 hover:border-blue-300">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex-1 font-bold text-blue-900">{task.title}</span>
              {!task.published && <span className="badge bg-slate-200 text-slate-700">{t("مسودة")}</span>}
              {task.published && task.dueAt > now && <span className="badge bg-emerald-100 text-emerald-800">{t("مفتوحة")}</span>}
              {task.published && task.dueAt <= now && <span className="badge bg-slate-100 text-slate-600">{t("انتهى الموعد")}</span>}
              {Number(toMark) > 0 && <span className="badge bg-amber-100 text-amber-800">{t("{n} تحتاج تصحيح", { n: Number(toMark) })}</span>}
            </div>
            <div className="muted text-sm">
              {t(gradeLabel[task.gradeId] ?? "—")}{task.groupId && groups.get(task.groupId) ? ` · ${t("مجموعة")} ${groups.get(task.groupId)!.name}` : ""}
              {" · "}{t("التسليم:")} {dateTime(task.dueAt)} · {t("{n} سؤال", { n: Number(questions) })} · {t("سلّم {a} من {b}", { a: Number(submitted), b: Number(students) })}
            </div>
          </Link>
        ))}
        {!rows.length && <p className="card text-center text-slate-500">{t("لا توجد مهام بعد")}</p>}
      </div>
    </>
  );
}
