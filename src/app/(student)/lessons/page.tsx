import Link from "next/link";
import { requireStudent } from "@/lib/auth";
import { studentCatalog } from "@/lib/content";
import { gradeMap } from "@/lib/grades";
import { getI18n } from "@/i18n/server";

export default async function LessonsPage() {
  const { t } = await getI18n();
  const gradeLabel = await gradeMap();
  const { user, canViewPaid } = await requireStudent();
  const { units, lessons, done } = await studentCatalog(user, canViewPaid);
  return (
    <>
      <h1 className="h1">{t("الدروس")} <span className="muted">· {t(gradeLabel[user.grade ?? 0] ?? "—")}</span></h1>
      {units.map((u, i) => {
        const ls = lessons.filter((l) => l.unitId === u.id);
        const d = ls.filter((l) => done.has(l.id)).length;
        return (
          <section key={u.id} className="card p-0">
            <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-800">{i + 1}</span>
              <h2 className="flex-1 font-bold">{u.title}</h2>
              <span className="text-xs text-slate-500">{d}/{ls.length}</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {ls.map((l) => (
                <li key={l.id}>
                  <Link href={`/lessons/${l.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs ${done.has(l.id) ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300"}`}>
                      {done.has(l.id) ? "✓" : ""}
                    </span>
                    <span className="flex-1">{l.title}</span>
                    {l.status === "free" && <span className="badge bg-violet-100 text-violet-800">{t("مجاني")}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {!units.length && <p className="muted">{t("لا توجد دروس منشورة بعد.")}</p>}
    </>
  );
}
