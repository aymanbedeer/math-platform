import Link from "next/link";
import { asc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { lessonStatus } from "@/lib/subscription";
import { gradeMap, getGrades } from "@/lib/grades";
import { SubmitButton } from "@/components/client";
import { createLesson, createUnit, deleteUnit, updateUnit } from "@/app/actions/teacher";
import { getI18n } from "@/i18n/server";


export default async function Content({ searchParams }: { searchParams: Promise<{ grade?: string }> }) {
  const { t, date } = await getI18n();
  const gradeLabel = await gradeMap();
  const grades = await getGrades();
  const g = Number((await searchParams).grade) || 1;
  const units = await db.select().from(schema.units).where(eq(schema.units.grade, g)).orderBy(asc(schema.units.position), asc(schema.units.id));
  const lessons = units.length
    ? await db.select().from(schema.lessons).where(inArray(schema.lessons.unitId, units.map((u) => u.id)))
      .orderBy(asc(schema.lessons.position), asc(schema.lessons.id))
    : [];

  return (
    <>
      <h1 className="h1">{t("المحتوى")}</h1>
      <div className="flex gap-2">
        {grades.map(({ id: x }) => (
          <Link key={x} href={`/t/content?grade=${x}`} className={x === g ? "btn-primary" : "btn-light"}>{t(gradeLabel[x ?? 0] ?? "—")}</Link>
        ))}
      </div>

      {units.map((u) => {
        const ls = lessons.filter((l) => l.unitId === u.id);
        return (
          <section key={u.id} className="card space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="badge bg-slate-100 text-slate-600">{u.position}</span>
              <h2 className="flex-1 text-lg font-bold">{u.title}</h2>
              {u.visibleFrom && <span className="badge bg-amber-100 text-amber-800">{t("تظهر من")} {date(u.visibleFrom)}</span>}
            </div>
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
              {ls.map((l) => (
                <li key={l.id}>
                  <Link href={`/t/lessons/${l.id}`} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50">
                    <span className="text-slate-400">{l.position}.</span>
                    <span className="flex-1 font-medium">{l.title}</span>
                    <span className={`badge ${lessonStatus[l.status][1]}`}>{t(lessonStatus[l.status][0])}</span>
                  </Link>
                </li>
              ))}
              {!ls.length && <li className="px-3 py-2 text-sm text-slate-500">{t("لا توجد دروس بعد")}</li>}
            </ul>
            <form action={createLesson.bind(null, u.id)} className="flex gap-2">
              <input name="title" placeholder={t("عنوان درس جديد")} className="input" required />
              <input name="position" type="number" defaultValue={ls.length + 1} className="input w-20" title={t("الترتيب")} />
              <SubmitButton className="btn-primary whitespace-nowrap">{t("+ درس")}</SubmitButton>
            </form>
            <details className="text-sm">
              <summary className="cursor-pointer text-slate-500">{t("تعديل الوحدة")}</summary>
              <form action={updateUnit.bind(null, u.id)} className="mt-2 grid gap-2 sm:grid-cols-4">
                <input name="title" defaultValue={u.title} className="input sm:col-span-2" required />
                <input name="position" type="number" defaultValue={u.position} className="input" title={t("الترتيب")} />
                <input name="visibleFrom" type="date" defaultValue={u.visibleFrom ?? ""} className="input" title={t("تاريخ الظهور")} />
                <SubmitButton className="btn-light">{t("حفظ")}</SubmitButton>
              </form>
              <form action={deleteUnit.bind(null, u.id)} className="mt-2">
                <SubmitButton className="btn-danger" confirm={t("حذف وحدة «{title}» وكل دروسها وملفاتها؟", { title: u.title })}>{t("حذف الوحدة")}</SubmitButton>
              </form>
            </details>
          </section>
        );
      })}

      <section className="card">
        <h2 className="mb-3 font-bold">{t("وحدة جديدة في")} {t(gradeLabel[g ?? 0] ?? "—")}</h2>
        <form action={createUnit} className="grid gap-2 sm:grid-cols-5">
          <input type="hidden" name="grade" value={g} />
          <input name="title" placeholder={t("اسم الوحدة، مثل: التفاضل")} className="input sm:col-span-2" required />
          <input name="position" type="number" defaultValue={units.length + 1} className="input" title={t("الترتيب")} />
          <div>
            <input name="visibleFrom" type="date" className="input" title={t("تاريخ الظهور (اختياري)")} />
          </div>
          <SubmitButton>{t("إضافة الوحدة")}</SubmitButton>
        </form>
        <p className="muted mt-2">{t("تاريخ الظهور اختياري: اتركه فارغًا لتظهر الوحدة فورًا.")}</p>
      </section>
    </>
  );
}
