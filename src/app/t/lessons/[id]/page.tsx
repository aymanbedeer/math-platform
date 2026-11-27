import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { gradeMap } from "@/lib/grades";
import { SubmitButton } from "@/components/client";
import { deleteLesson, deleteLessonFile, updateFile, updateLesson } from "@/app/actions/teacher";
import { AddLink, AddVideo, PdfDrop } from "./forms";
import { getI18n } from "@/i18n/server";

const kindLabel = { video: "فيديو", pdf: "PDF", link: "رابط" } as const;

export default async function LessonEditor({ params }: { params: Promise<{ id: string }> }) {
  const { t } = await getI18n();
  const gradeLabel = await gradeMap();
  const id = Number((await params).id);
  const [row] = await db.select({ l: schema.lessons, u: schema.units }).from(schema.lessons)
    .innerJoin(schema.units, eq(schema.units.id, schema.lessons.unitId)).where(eq(schema.lessons.id, id));
  if (!row) notFound();
  const { l, u } = row;
  const files = await db.select().from(schema.lessonFiles).where(eq(schema.lessonFiles.lessonId, id))
    .orderBy(asc(schema.lessonFiles.position), asc(schema.lessonFiles.id));

  return (
    <>
      <div className="text-sm text-slate-500">
        <Link href={`/t/content?grade=${u.grade}`} className="underline">{t(gradeLabel[u.grade ?? 0] ?? "—")}</Link> / {u.title}
      </div>
      <h1 className="h1">{l.title}</h1>

      <section className="card">
        <form action={updateLesson.bind(null, id)} className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-4">
            <div className="sm:col-span-2"><label className="label">{t("العنوان")}</label><input name="title" defaultValue={l.title} className="input" required /></div>
            <div><label className="label">{t("الترتيب")}</label><input name="position" type="number" defaultValue={l.position} className="input" /></div>
            <div>
              <label className="label">{t("الحالة")}</label>
              <select name="status" defaultValue={l.status} className="input">
                <option value="draft">{t("مسوّدة (لا يراها الطلاب)")}</option>
                <option value="published">{t("منشور للمشتركين")}</option>
                <option value="free">{t("مجاني (مفتوح للجميع)")}</option>
              </select>
            </div>
          </div>
          <div><label className="label">{t("وصف قصير")}</label><textarea name="description" defaultValue={l.description} rows={2} className="input" /></div>
          <SubmitButton>{t("حفظ الدرس")}</SubmitButton>
        </form>
      </section>

      <section className="card space-y-3">
        <h2 className="font-bold">{t("ملفات الدرس")}</h2>
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
          {files.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-2 p-2">
              <span className="badge bg-slate-100 text-slate-700">{t(kindLabel[f.kind])}</span>
              <form action={updateFile.bind(null, f.id)} className="flex flex-1 flex-wrap items-center gap-2">
                <input name="title" defaultValue={f.title} className="input min-w-40 flex-1" />
                <input name="position" type="number" defaultValue={f.position} className="input w-16" title={t("الترتيب")} />
                {f.kind === "pdf" && (
                  <label className="flex items-center gap-1 text-sm">
                    <input type="checkbox" name="allowDownload" defaultChecked={f.allowDownload} /> {t("يسمح بالتحميل")}
                  </label>
                )}
                <SubmitButton className="btn-light">{t("حفظ")}</SubmitButton>
              </form>
              {f.kind === "pdf" && <a href={`/api/files/${f.id}`} target="_blank" className="btn-light">{t("معاينة")}</a>}
              {f.kind !== "pdf" && f.url && (
                <a href={f.kind === "video" ? `https://youtu.be/${f.url}` : f.url} target="_blank" className="btn-light">{t("فتح")}</a>
              )}
              <form action={deleteLessonFile.bind(null, f.id)}>
                <SubmitButton className="btn-danger" confirm={t("حذف هذا الملف؟")}>{t("حذف")}</SubmitButton>
              </form>
            </li>
          ))}
          {!files.length && <li className="p-3 text-sm text-slate-500">{t("لم تُضف ملفات بعد")}</li>}
        </ul>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <AddVideo lessonId={id} position={files.length + 1} />
        <PdfDrop lessonId={id} position={files.length + 1} />
        <AddLink lessonId={id} position={files.length + 1} />
      </div>

      <form action={deleteLesson.bind(null, id)}>
        <SubmitButton className="btn-danger" confirm={t("حذف الدرس وكل ملفاته؟")}>{t("حذف الدرس")}</SubmitButton>
      </form>
    </>
  );
}
