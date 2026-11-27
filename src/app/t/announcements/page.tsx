import { desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { gradeMap, getGrades } from "@/lib/grades";
import { SubmitButton } from "@/components/client";
import { createAnnouncement, deleteAnnouncement, toggleAnnouncement } from "@/app/actions/teacher";
import { getI18n } from "@/i18n/server";

export default async function Announcements() {
  const { t, dateTime } = await getI18n();
  const gradeLabel = await gradeMap();
  const grades = await getGrades();
  const rows = await db.select().from(schema.announcements).orderBy(desc(schema.announcements.createdAt));
  return (
    <>
      <h1 className="h1">{t("الإعلانات")}</h1>
      <form action={createAnnouncement} className="card space-y-3">
        <textarea name="body" rows={3} className="input" placeholder={t("مثال: حصة مراجعة يوم الخميس الساعة 7 مساءً")} required />
        <div className="flex gap-2">
          <select name="grade" className="input w-auto">
            <option value="0">{t("لكل الطلاب")}</option>
            {grades.map(({ id: g }) => <option key={g} value={g}>{t(gradeLabel[g ?? 0] ?? "—")} {t("فقط")}</option>)}
          </select>
          <SubmitButton>{t("نشر الإعلان")}</SubmitButton>
        </div>
      </form>
      <ul className="space-y-2">
        {rows.map((a) => (
          <li key={a.id} className={`card flex flex-wrap items-start gap-3 ${a.active ? "" : "opacity-60"}`}>
            <div className="flex-1">
              <p className="whitespace-pre-line">{a.body}</p>
              <p className="muted mt-1">{a.grade ? t(gradeLabel[a.grade ?? 0] ?? "—") : t("كل الطلاب")} · {dateTime(a.createdAt)}{!a.active && t(" · مخفي")}</p>
            </div>
            <form action={toggleAnnouncement.bind(null, a.id, !a.active)}>
              <SubmitButton className="btn-light">{a.active ? t("إخفاء") : t("إظهار")}</SubmitButton>
            </form>
            <form action={deleteAnnouncement.bind(null, a.id)}>
              <SubmitButton className="btn-danger" confirm={t("حذف الإعلان؟")}>{t("حذف")}</SubmitButton>
            </form>
          </li>
        ))}
      </ul>
    </>
  );
}
