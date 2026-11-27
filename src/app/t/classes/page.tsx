import Link from "next/link";
import { sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { getI18n } from "@/i18n/server";
import { SubmitButton } from "@/components/client";
import { addGrade, addGroup, deleteGrade, deleteGroup, renameGrade, renameGroup } from "@/app/actions/classes";
import AddForm from "./add-form";

export default async function Classes() {
  const { t } = await getI18n();
  const grades = await db.select({
    id: schema.grades.id, name: schema.grades.name,
    students: sql<number>`(select count(*) from users u where u.grade = "grades"."id" and u.role = 'student')`,
    used: sql<number>`(select count(*) from units where units.grade = "grades"."id") + (select count(*) from announcements a where a.grade = "grades"."id")`,
  }).from(schema.grades).orderBy(schema.grades.position, schema.grades.id);
  const groups = (await db.select({
    id: schema.groups.id, name: schema.groups.name, gradeId: schema.groups.gradeId,
    students: sql<number>`(select count(*) from users u where u.group_id = "groups"."id" and u.role = 'student')`,
  }).from(schema.groups)).sort((a, b) => a.name.localeCompare(b.name, "ar", { numeric: true }));

  return (
    <>
      <h1 className="h1">{t("الصفوف والمجموعات")}</h1>
      <p className="muted">{t("كل صف له دروسه الخاصة، والطالب يرى دروس صفّه فقط. المجموعات داخل كل صف للتنظيم، مثل مواعيد الحصص.")}</p>
      <div className="grid gap-4 lg:grid-cols-2">
        {grades.map((g) => {
          const mine = groups.filter((x) => x.gradeId === g.id);
          return (
            <section key={g.id} className="card space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <form action={renameGrade.bind(null, g.id)} className="flex min-w-0 flex-1 gap-2">
                  <input name="name" defaultValue={g.name} className="input min-w-0 flex-1 font-bold" maxLength={60} aria-label={t("اسم الصف")} />
                  <SubmitButton className="btn-light">{t("حفظ")}</SubmitButton>
                </form>
                <Link href={`/t/students?grade=${g.id}`} className="badge bg-slate-100 text-slate-700 hover:underline">{t("{n} طالب", { n: Number(g.students) })}</Link>
                {Number(g.students) + Number(g.used) === 0 && (
                  <form action={deleteGrade.bind(null, g.id)}>
                    <SubmitButton className="btn-danger" confirm={t("حذف {name} ومجموعاته؟", { name: g.name })}>{t("حذف")}</SubmitButton>
                  </form>
                )}
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <h3 className="mb-2 text-sm font-semibold text-slate-600">{t("مجموعات هذا الصف")}</h3>
                <ul className="divide-y divide-slate-200">
                  {mine.map((x) => (
                    <li key={x.id} className="flex flex-wrap items-center gap-2 py-2">
                      <form action={renameGroup.bind(null, x.id)} className="flex min-w-0 flex-1 gap-2">
                        <input name="name" defaultValue={x.name} className="input min-w-0 flex-1" maxLength={60} aria-label={t("اسم المجموعة")} />
                        <SubmitButton className="btn-light">{t("حفظ")}</SubmitButton>
                      </form>
                      <Link href={`/t/students?group=${x.id}`} className="badge bg-amber-100 text-amber-800 hover:underline">{t("{n} طالب", { n: Number(x.students) })}</Link>
                      <form action={deleteGroup.bind(null, x.id)}>
                        <SubmitButton className="btn-danger" confirm={t("حذف المجموعة {name}؟ سيبقى طلابها بدون مجموعة.", { name: x.name })}>{t("حذف")}</SubmitButton>
                      </form>
                    </li>
                  ))}
                  {!mine.length && <li className="py-2 text-sm text-slate-500">{t("لا توجد مجموعات بعد")}</li>}
                </ul>
                <div className="mt-2">
                  <AddForm action={addGroup} hidden={{ gradeId: g.id }} placeholder={t("رقم أو اسم المجموعة، مثل: 3 أو مجموعة السبت")} button={t("+ إضافة مجموعة")} />
                </div>
              </div>
            </section>
          );
        })}
        <section className="card space-y-3">
          <h2 className="font-bold">{t("صف جديد")}</h2>
          <AddForm action={addGrade} placeholder={t("اسم الصف الجديد، مثل: الثالث الإعدادي")} button={t("+ إضافة صف")} />
          <p className="muted text-xs">{t("لا يمكن حذف صف فيه طلاب أو دروس أو إعلانات.")}</p>
        </section>
      </div>
    </>
  );
}
