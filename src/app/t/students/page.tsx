import Link from "next/link";
import { getSettings } from "@/lib/auth";
import { statusLabel } from "@/lib/subscription";
import { gradeMap, getGrades } from "@/lib/grades";
import { listStudents } from "@/lib/students";
import { getGroups } from "@/lib/grades";
import { StatusBadge } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { bulkUpdateStudents } from "@/app/actions/teacher";
import BulkBar from "./bulk";

export default async function Students({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { t, date } = await getI18n();
  const gradeLabel = await gradeMap();
  const grades = await getGrades();
  const sp = await searchParams;
  const s = await getSettings();
  const q = (sp.q || "").trim();
  let rows = await listStudents(s.graceDays);
  const groups = await getGroups();
  if (q) rows = rows.filter((r) => r.fullName.includes(q) || r.username.includes(q.toLowerCase()) || (r.parentPhone || "").includes(q));
  if (sp.grade) rows = rows.filter((r) => String(r.grade) === sp.grade);
  if (sp.group) rows = rows.filter((r) => (sp.group === "-" ? !r.groupId : String(r.groupId) === sp.group));
  const groupName = new Map(groups.map((g) => [g.id, g.name]));
  const groupsByGrade = grades.map((g) => ({ ...g, groups: groups.filter((x) => x.gradeId === g.id) })).filter((g) => g.groups.length);
  if (sp.status) rows = rows.filter((r) => r.status === sp.status);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="h1 flex-1">{t("الطلاب")} <span className="muted">({rows.length})</span></h1>
        <Link href="/t/students/new" className="btn-primary">{t("+ إضافة طالب")}</Link>
      </div>
      <form className="card flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder={t("بحث بالاسم أو اسم المستخدم أو الرقم")} className="input min-w-52 flex-1" />
        <select name="grade" defaultValue={sp.grade || ""} className="input w-auto">
          <option value="">{t("كل الصفوف")}</option>
          {grades.map(({ id: g }) => <option key={g} value={g}>{t(gradeLabel[g ?? 0] ?? "—")}</option>)}
        </select>
        <select name="group" defaultValue={sp.group || ""} className="input w-auto">
          <option value="">{t("كل المجموعات")}</option>
          {groupsByGrade.filter((g) => !sp.grade || String(g.id) === sp.grade).map((g) => (
            <optgroup key={g.id} label={t(g.name)}>
              {g.groups.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </optgroup>
          ))}
          <option value="-">{t("بدون مجموعة")}</option>
        </select>
        <select name="status" defaultValue={sp.status || ""} className="input w-auto">
          <option value="">{t("كل الحالات")}</option>
          {Object.entries(statusLabel).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
        </select>
        <button className="btn-light">{t("تصفية")}</button>
      </form>
      <form action={bulkUpdateStudents} className="space-y-3">
      <BulkBar groups={groupsByGrade.map((g) => ({ grade: t(g.name), groups: g.groups.map((x) => ({ id: x.id, name: x.name })) }))} grades={grades.map((g) => ({ id: g.id, name: t(g.name) }))} />
      <div className="card overflow-x-auto p-0">
        <table className="tbl">
          <thead>
            <tr><th className="w-8"></th><th>{t("الاسم")}</th><th>{t("الصف")}</th><th>{t("المجموعة")}</th><th>{t("رقم ولي الأمر")}</th><th>{t("الحالة")}</th><th>{t("ينتهي")}</th><th>{t("آخر دفع")}</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td><input type="checkbox" name="ids" value={r.id} className="h-4 w-4" aria-label={r.fullName} /></td>
                <td>
                  <Link href={`/t/students/${r.id}`} className="font-semibold text-blue-800 hover:underline">{r.fullName}</Link>
                  <div className="text-xs text-slate-400" dir="ltr">{r.username}</div>
                </td>
                <td className="whitespace-nowrap">{t(gradeLabel[r.grade ?? 0] ?? "—")}</td>
                <td className="whitespace-nowrap">{r.groupId && groupName.has(r.groupId) ? <Link href={`/t/students?group=${r.groupId}`} className="badge bg-amber-100 text-amber-800 hover:underline">{groupName.get(r.groupId)}</Link> : <span className="text-slate-400">—</span>}</td>
                <td dir="ltr" className="text-end">{r.parentPhone || "—"}</td>
                <td>
                  <StatusBadge status={r.status} />
                  {r.exempt && <span className="badge ms-1 bg-blue-100 text-blue-800">{t("معفى")}</span>}
                  {r.suspended && <span className="badge ms-1 bg-slate-200 text-slate-700">{t("موقوف يدويًا")}</span>}
                </td>
                <td className="whitespace-nowrap">{r.exempt ? "—" : date(r.expiresAt)}</td>
                <td className="whitespace-nowrap">{date(r.lastPayment)}</td>
                <td><Link href={`/t/students/${r.id}#pay`} className="btn-light whitespace-nowrap">{t("تسجيل دفع")}</Link></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={9} className="py-8 text-center text-slate-500">{t("لا يوجد طلاب")}</td></tr>}
          </tbody>
        </table>
      </div>
      </form>
    </>
  );
}
