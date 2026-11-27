import Link from "next/link";
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { localDate } from "@/db/sql";
import { getSettings } from "@/lib/auth";
import { gradeMap, getGrades } from "@/lib/grades";
import { listStudents } from "@/lib/students";
import { StatusBadge } from "@/components/ui";
import { getI18n } from "@/i18n/server";

export default async function Reports({ searchParams }: { searchParams: Promise<{ grade?: string; lesson?: string }> }) {
  const { t, date, dateTime, money } = await getI18n();
  const gradeLabel = await gradeMap();
  const grades = await getGrades();
  const sp = await searchParams;
  const g = Number(sp.grade) || 1;
  const s = await getSettings();
  const students = await listStudents(s.graceDays);
  const weekAgo = Date.now() - 7 * 86400000;
  const inactive = students.filter((x) => x.status !== "locked" && (!x.lastSeenAt || x.lastSeenAt.getTime() < weekAgo));

  const monthly = await db.select({
    month: sql<string>`substr(${localDate(schema.payments.createdAt)}, 1, 7)`.as("month"),
    total: sql<number>`sum(${schema.payments.amount})::int`,
    n: sql<number>`count(*)::int`,
  }).from(schema.payments).groupBy(sql`1`).orderBy(sql`1 desc`).limit(24);

  const lessons = await db.select({ id: schema.lessons.id, title: schema.lessons.title, unit: schema.units.title })
    .from(schema.lessons).innerJoin(schema.units, eq(schema.units.id, schema.lessons.unitId))
    .where(and(eq(schema.units.grade, g), ne(schema.lessons.status, "draft")))
    .orderBy(asc(schema.units.position), asc(schema.lessons.position));
  const ids = lessons.map((l) => l.id);
  const viewCounts = ids.length ? await db.select({ id: schema.lessonViews.lessonId, n: sql<number>`count(*)::int` })
    .from(schema.lessonViews).where(inArray(schema.lessonViews.lessonId, ids)).groupBy(schema.lessonViews.lessonId) : [];
  const doneCounts = ids.length ? await db.select({ id: schema.completions.lessonId, n: sql<number>`count(*)::int` })
    .from(schema.completions).where(inArray(schema.completions.lessonId, ids)).groupBy(schema.completions.lessonId) : [];
  const vc = new Map(viewCounts.map((r) => [r.id, r.n]));
  const dc = new Map(doneCounts.map((r) => [r.id, r.n]));
  const gradeStudents = students.filter((x) => x.grade === g);

  const sel = Number(sp.lesson) || 0;
  const selViews = sel ? await db.select().from(schema.lessonViews).where(eq(schema.lessonViews.lessonId, sel)) : [];
  const viewedBy = new Map(selViews.map((v) => [v.studentId, v]));

  return (
    <>
      <h1 className="h1">{t("التقارير")}</h1>

      <section className="card overflow-x-auto">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="flex-1 font-bold">{t("سجل التحصيل الشهري")}</h2>
          <a href="/t/reports/payments.csv" className="btn-light">{t("تصدير كل المدفوعات (Excel / CSV)")}</a>
        </div>
        <table className="tbl">
          <thead><tr><th>{t("الشهر")}</th><th>{t("عدد الدفعات")}</th><th>{t("الإجمالي")}</th></tr></thead>
          <tbody>
            {monthly.map((m) => <tr key={m.month}><td>{m.month}</td><td>{m.n}</td><td className="font-semibold">{money(m.total)}</td></tr>)}
            {!monthly.length && <tr><td colSpan={3} className="text-slate-500">{t("لا توجد مدفوعات")}</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2 className="mb-1 font-bold">{t("لم يدخلوا منذ أسبوع (")}{inactive.length})</h2>
        <p className="muted mb-3">{t("من الطلاب غير الموقوفين.")}</p>
        <ul className="grid gap-1 text-sm sm:grid-cols-2">
          {inactive.map((x) => (
            <li key={x.id}>
              <Link href={`/t/students/${x.id}`} className="text-blue-800 underline">{x.fullName}</Link>
              <span className="text-slate-500"> · {t(gradeLabel[x.grade ?? 0] ?? "—")} {t("· آخر دخول")} {x.lastSeenAt ? date(x.lastSeenAt) : t("لم يدخل")}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card overflow-x-auto">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="flex-1 font-bold">{t("مشاهدة الدروس")}</h2>
          {grades.map(({ id: x }) => (
            <Link key={x} href={`/t/reports?grade=${x}`} className={x === g ? "btn-primary" : "btn-light"}>{t(gradeLabel[x ?? 0] ?? "—")}</Link>
          ))}
        </div>
        <table className="tbl">
          <thead><tr><th>{t("الدرس")}</th><th>{t("شاهده")}</th><th>{t("أنهاه")}</th><th></th></tr></thead>
          <tbody>
            {lessons.map((l) => (
              <tr key={l.id} className={l.id === sel ? "bg-blue-50" : ""}>
                <td>{l.title}<div className="text-xs text-slate-500">{l.unit}</div></td>
                <td>{vc.get(l.id) ?? 0} / {gradeStudents.length}</td>
                <td>{dc.get(l.id) ?? 0}</td>
                <td><Link href={`/t/reports?grade=${g}&lesson=${l.id}`} className="btn-light">{t("التفاصيل")}</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        {sel > 0 && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 font-semibold text-emerald-800">{t("شاهدوا الدرس")}</h3>
              <ul className="space-y-1 text-sm">
                {gradeStudents.filter((x) => viewedBy.has(x.id)).map((x) => (
                  <li key={x.id}>{x.fullName} <span className="text-slate-500">· {dateTime(viewedBy.get(x.id)!.lastViewedAt)} · {viewedBy.get(x.id)!.count} {t("مرة")}</span></li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-2 font-semibold text-rose-800">{t("لم يشاهدوه")}</h3>
              <ul className="space-y-1 text-sm">
                {gradeStudents.filter((x) => !viewedBy.has(x.id)).map((x) => (
                  <li key={x.id} className="flex items-center gap-2">{x.fullName} <StatusBadge status={x.status} /></li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
