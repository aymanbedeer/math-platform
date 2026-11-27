import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireStudent } from "@/lib/auth";
import { lessonForStudent } from "@/lib/content";
import { signFileToken } from "@/lib/crypto";
import { setCompleted } from "@/app/actions/student";
import { SubmitButton } from "@/components/client";
import PdfViewer from "@/components/pdf-viewer";
import VideoPlayer from "@/components/video-player";
import { getI18n } from "@/i18n/server";

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { t } = await getI18n();
  const id = Number((await params).id);
  const { user, canViewPaid } = await requireStudent();
  const row = await lessonForStudent(id, user, canViewPaid);
  if (!row) notFound();
  const { l, u } = row;

  await db.insert(schema.lessonViews).values({ studentId: user.id, lessonId: id })
    .onConflictDoUpdate({
      target: [schema.lessonViews.studentId, schema.lessonViews.lessonId],
      set: { lastViewedAt: new Date(), count: sql`${schema.lessonViews.count} + 1` },
    });

  const files = await db.select().from(schema.lessonFiles).where(eq(schema.lessonFiles.lessonId, id))
    .orderBy(asc(schema.lessonFiles.position), asc(schema.lessonFiles.id));
  const [done] = await db.select().from(schema.completions)
    .where(and(eq(schema.completions.studentId, user.id), eq(schema.completions.lessonId, id)));
  const mark = `${user.fullName} · ${user.username}`;
  const tokens = new Map(await Promise.all(
    files.filter((f) => f.kind === "pdf").map(async (f) => [f.id, await signFileToken(f.id, user.id)] as const)));

  return (
    <>
      <div className="text-sm text-slate-500"><Link href="/lessons" className="underline">{t("الدروس")}</Link> / {u.title}</div>
      <h1 className="h1">{l.title}</h1>
      {l.description && <p className="text-slate-600">{l.description}</p>}

      {files.map((f) => (
        <section key={f.id} className="space-y-2">
          {files.length > 1 && f.kind !== "link" && <h2 className="font-semibold">{f.title}</h2>}
          {f.kind === "video" && f.url && <VideoPlayer videoId={f.url} watermark={mark} />}
          {f.kind === "pdf" && (
            <PdfViewer src={`/api/files/${f.id}?t=${tokens.get(f.id)}`} watermark={mark} allowDownload={f.allowDownload} />
          )}
          {f.kind === "link" && f.url && (
            <a href={f.url} target="_blank" rel="noopener noreferrer" className="card flex items-center gap-3 hover:border-blue-300">
              <span className="text-2xl">↗</span><span className="flex-1 font-semibold">{f.title}</span>
            </a>
          )}
        </section>
      ))}
      {!files.length && <p className="muted">{t("لم تُضف ملفات لهذا الدرس بعد.")}</p>}

      <form action={setCompleted.bind(null, id, !done)} className="pt-2">
        <SubmitButton className={done ? "btn-light w-full py-3" : "btn-green w-full py-3"}>
          {done ? t("✓ أنهيت هذا الدرس (إلغاء)") : t("تم الانتهاء من الدرس")}
        </SubmitButton>
      </form>
    </>
  );
}
