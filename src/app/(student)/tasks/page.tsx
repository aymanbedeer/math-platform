import Link from "next/link";
import { requireStudent } from "@/lib/auth";
import { submissionsByStudent, taskState, tasksForStudent, type TaskState } from "@/lib/tasks";
import { getI18n } from "@/i18n/server";
import { redirect } from "next/navigation";

export default async function StudentTasks() {
  const { t, dateTime } = await getI18n();
  const { user, canViewPaid } = await requireStudent();
  if (!canViewPaid) redirect("/");
  const tasks = await tasksForStudent(user);
  const subs = await submissionsByStudent(user.id, tasks.map((x) => x.id));
  const rows = tasks.map((task) => ({ task, sub: subs.get(task.id), state: taskState(task, subs.get(task.id)) }));
  const groups: { title: string; states: TaskState[] }[] = [
    { title: t("مطلوب منك"), states: ["open", "late_open"] },
    { title: t("سلّمتها"), states: ["submitted", "graded"] },
    { title: t("فاتها الموعد"), states: ["missed"] },
  ];
  const now = Date.now();

  return (
    <>
      <h1 className="h1">{t("المهام")}</h1>
      {!rows.length && <p className="card text-center text-slate-500">{t("لا توجد مهام حاليًا")}</p>}
      {groups.map((g) => {
        const list = rows.filter((r) => g.states.includes(r.state));
        if (!list.length) return null;
        const ordered = g.states.includes("open") ? list : [...list].reverse();
        return (
          <section key={g.title} className="space-y-2">
            <h2 className="font-bold">{g.title} <span className="muted">({list.length})</span></h2>
            {ordered.map(({ task, sub, state }) => {
              const hours = (task.dueAt.getTime() - now) / 3600000;
              return (
                <Link key={task.id} href={`/tasks/${task.id}`} className="card flex flex-wrap items-center gap-2 hover:border-blue-300">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-blue-900">{task.title}</div>
                    <div className="muted text-xs">{t("التسليم:")} {dateTime(task.dueAt)}</div>
                  </div>
                  {state === "open" && hours < 24 && <span className="badge bg-red-100 text-red-700">{t("ينتهي اليوم")}</span>}
                  {state === "open" && hours >= 24 && <span className="badge bg-emerald-100 text-emerald-800">{t("مفتوحة")}</span>}
                  {state === "late_open" && <span className="badge bg-orange-100 text-orange-800">{t("متأخرة، ما زال التسليم ممكنًا")}</span>}
                  {state === "submitted" && <span className="badge bg-amber-100 text-amber-800">{t("بانتظار التصحيح")}</span>}
                  {state === "graded" && sub && <span className="badge bg-blue-100 text-blue-800">{t("الدرجة")} {sub.score}</span>}
                  {state === "missed" && <span className="badge bg-slate-200 text-slate-600">{t("لم تُسلَّم")}</span>}
                </Link>
              );
            })}
          </section>
        );
      })}
    </>
  );
}
