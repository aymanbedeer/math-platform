import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrent, getSettings } from "@/lib/auth";
import { lessonForStudent } from "@/lib/content";
import { verifyFileToken } from "@/lib/crypto";
import { subscriptionStatus } from "@/lib/subscription";
import { getFile } from "@/lib/storage";

const deny = (status = 403) => new Response("غير مسموح", { status });

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const url = new URL(req.url);
  const cur = await getCurrent();
  if (!cur) return deny(401);
  const [file] = await db.select().from(schema.lessonFiles).where(eq(schema.lessonFiles.id, id));
  if (!file || file.kind !== "pdf" || !file.storageKey) return deny(404);
  const download = url.searchParams.get("download") === "1";

  if (cur.user.role === "student") {
    // The link must be fresh and issued to this same student
    if (!(await verifyFileToken(url.searchParams.get("t") || "", id, cur.user.id))) return deny();
    const s = await getSettings();
    const canViewPaid = subscriptionStatus(cur.user, s.graceDays) !== "locked";
    if (!(await lessonForStudent(file.lessonId, cur.user, canViewPaid))) return deny();
    if (download && !file.allowDownload) return deny();
  }

  const data = await getFile(file.storageKey);
  if (!data) return deny(404);
  const name = encodeURIComponent(file.title) + ".pdf";
  return new Response(data, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${name}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
