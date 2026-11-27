import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrent, requireStudent } from "@/lib/auth";
import { studentCatalog } from "@/lib/content";
import { daysLeft } from "@/lib/subscription";
import { gradeMap } from "@/lib/grades";
import { Notice, StatusBadge, whatsappLink } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { submissionsByStudent, taskState, tasksForStudent } from "@/lib/tasks";

export default async function Home() {
  const { t, date } = await getI18n();
  const gradeLabel = await gradeMap();
  const cur = await getCurrent();
  if (!cur) redirect("/login");
  if (cur.user.role === "teacher") redirect("/t");
  const { user, status, settings: s, canViewPaid } = await requireStudent();
  const { lessons, units, done } = await studentCatalog(user, canViewPaid);

  if (!canViewPaid) return <Locked name={user.fullName} whatsapp={s.whatsapp} teacher={s.teacherName} lessons={lessons} />;

  const left = daysLeft(user.expiresAt);
  const latest = [...lessons].sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0)).slice(0, 5);
  const unitTitle = new Map(units.map((u) => [u.id, u.title]));
  const news = await db.select().from(schema.announcements)
    .where(and(eq(schema.announcements.active, true), or(isNull(schema.announcements.grade), eq(schema.announcements.grade, user.grade ?? 0))))
    .orderBy(desc(schema.announcements.createdAt)).limit(5);
  const allTasks = await tasksForStudent(user);
  const taskSubs = await submissionsByStudent(user.id, allTasks.map((x) => x.id));
  const dueTasks = allTasks.filter((x) => ["open", "late_open"].includes(taskState(x, taskSubs.get(x.id)))).slice(0, 3);
  const pct = lessons.length ? Math.round((lessons.filter((l) => done.has(l.id)).length / lessons.length) * 100) : 0;

  return (
    <>
      <h1 className="h1">{t("أهلًا")} {user.fullName.split(" ")[0]} 👋</h1>

      {user.mustChangePassword && (
        <Notice kind="info">{t("أنت تستخدم كلمة مرور مؤقتة.")} <Link href="/account" className="font-semibold underline">{t("غيّرها من «حسابي»")}</Link>.</Notice>
      )}
      {status === "grace" && (
        <Notice kind="warn">{t("انتهى اشتراكك يوم {date}. أنت الآن في فترة سماح، جدّد قريبًا حتى لا يتوقف حسابك.", { date: date(user.expiresAt) })}</Notice>
      )}
      {status === "active" && !user.exempt && left !== null && left <= s.reminderDays && (
        <Notice kind="warn">{left === 0 ? t("ينتهي اشتراكك اليوم ({date}). تواصل مع الأستاذ للتجديد.", { date: date(user.expiresAt) }) : t("ينتهي اشتراكك بعد {n} يوم ({date}). تواصل مع الأستاذ للتجديد.", { n: left, date: date(user.expiresAt) })}</Notice>
      )}

      <section className="card flex flex-wrap items-center gap-4">
        <div className="flex-1">
          <div className="muted">{t("حالة الاشتراك")}</div>
          <div className="mt-1 flex items-center gap-2"><StatusBadge status={status} />
            <span className="text-sm">{user.exempt ? t("معفى من الدفع") : t("حتى {date}", { date: date(user.expiresAt) })}</span></div>
        </div>
        <div>
          <div className="muted">{t(gradeLabel[user.grade ?? 0] ?? "—")}</div>
          <div className="mt-1 text-sm font-semibold">{t("أنهيت")} {pct}{t("% من الدروس")}</div>
        </div>
      </section>

      {dueTasks.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center"><h2 className="flex-1 font-bold">{t("مهام مطلوبة منك")}</h2><Link href="/tasks" className="text-sm text-blue-800 underline">{t("كل المهام")}</Link></div>
          {dueTasks.map((x) => (
            <Link key={x.id} href={`/tasks/${x.id}`} className="card flex items-center gap-2 border-amber-200 bg-amber-50 hover:border-amber-400">
              <span className="text-xl">✎</span>
              <span className="flex-1 font-semibold">{x.title}</span>
              <span className="muted text-xs">{t("التسليم:")} {date(x.dueAt)}</span>
            </Link>
          ))}
        </section>
      )}

      {news.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-bold">{t("إعلانات هامة")}</h2>
          {news.map((a) => (
            <div key={a.id} className="card border-blue-200 bg-blue-50">
              <p className="whitespace-pre-line">{a.body}</p>
              <p className="mt-1 text-xs text-slate-500">{date(a.createdAt)}</p>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-2">
        <div className="flex items-center">
          <h2 className="flex-1 font-bold">{t("آخر الدروس")}</h2>
          <Link href="/lessons" className="text-sm text-blue-800 underline">{t("كل الدروس")}</Link>
        </div>
        {latest.map((l) => (
          <Link key={l.id} href={`/lessons/${l.id}`} className="card flex items-center gap-3 hover:border-blue-300">
            <div className="flex-1">
              <div className="font-semibold">{l.title}</div>
              <div className="text-xs text-slate-500">{unitTitle.get(l.unitId)}</div>
            </div>
            {done.has(l.id) && <span className="badge bg-emerald-100 text-emerald-800">{t("✓ أنهيته")}</span>}
          </Link>
        ))}
        {!latest.length && <p className="muted">{t("لا توجد دروس بعد.")}</p>}
      </section>
    </>
  );
}

async function Locked({ name, whatsapp, teacher, lessons }: {
  name: string; whatsapp: string; teacher: string; lessons: { id: number; title: string }[];
}) {
  const { t } = await getI18n();
  return (
    <>
      <section className="card space-y-4 py-8 text-center">
        <div className="text-5xl">🔒</div>
        <h1 className="h1">{t("اشتراكك متوقف")}</h1>
        <p className="text-slate-600">{t("يرجى التواصل مع")} {teacher} {t("لتجديده، وسيُفتح حسابك فور تسجيل الدفع.")}</p>
        {whatsapp && (
          <div className="flex flex-col items-center gap-2">
            <a href={whatsappLink(whatsapp, t("السلام عليكم، أنا {name} وأريد تجديد اشتراكي في المنصة.", { name }))} target="_blank"
              className="btn-green px-6 py-3 text-base">{t("تواصل عبر واتساب")}</a>
            <span className="text-sm text-slate-500" dir="ltr">{whatsapp}</span>
          </div>
        )}
      </section>
      {lessons.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-bold">{t("دروس مجانية متاحة لك")}</h2>
          {lessons.map((l) => (
            <Link key={l.id} href={`/lessons/${l.id}`} className="card block font-semibold hover:border-blue-300">{l.title}</Link>
          ))}
        </section>
      )}
    </>
  );
}
