import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrent } from "@/lib/auth";
import { getFile } from "@/lib/storage";

const deny = (status = 403) => new Response("غير مسموح", { status });
const INLINE = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];

/** A file a student uploaded as an answer: only that student and the teacher can open it. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const cur = await getCurrent();
  if (!cur) return deny(401);
  const id = Number((await params).id);
  const [row] = await db.select({ f: schema.answerFiles, studentId: schema.taskSubmissions.studentId })
    .from(schema.answerFiles)
    .innerJoin(schema.taskAnswers, eq(schema.taskAnswers.id, schema.answerFiles.answerId))
    .innerJoin(schema.taskSubmissions, eq(schema.taskSubmissions.id, schema.taskAnswers.submissionId))
    .where(eq(schema.answerFiles.id, id));
  if (!row) return deny(404);
  if (cur.user.role !== "teacher" && cur.user.id !== row.studentId) return deny();
  const data = await getFile(row.f.storageKey);
  if (!data) return deny(404);
  const inline = INLINE.includes(row.f.mime) && new URL(req.url).searchParams.get("download") !== "1";
  return new Response(data, {
    headers: {
      "Content-Type": inline ? row.f.mime : "application/octet-stream",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(row.f.name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      ...(row.f.mime === "application/pdf" ? {} : { "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox" }),
    },
  });
}
