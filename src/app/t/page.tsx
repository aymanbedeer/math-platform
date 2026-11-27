import Link from "next/link";
import { eq, gte, sum } from "drizzle-orm";
import { db, schema } from "@/db";
import { localDate } from "@/db/sql";
import { getSettings } from "@/lib/auth";
import { addDays, monthStart, today } from "@/lib/dates";
import { gradeMap } from "@/lib/grades";
import { listStudents } from "@/lib/students";
import { Stat, StatusBadge, whatsappLink } from "@/components/ui";
import { dismissRequest } from "@/app/actions/teacher";
import { getI18n } from "@/i18n/server";

export default async function Summary() {
  const { t, dateTime, money } = await getI18n();
  const s = await getSettings();
  const students = await listStudents(s.graceDays);
  const td = today();
  const weekEnd = addDays(td, 7);
  const count = (st: string) => students.filter((x) => x.status === st).length;
  const [{ total }] = await db.select({ total: sum(schema.payments.amount) }).from(schema.payments)
    .where(gte(localDate(schema.payments.createdAt), monthStart(td)));
  const expiring = students
    .filter((x) => !x.exempt && !x.suspended && x.expiresAt && x.expiresAt >= td && x.expiresAt <= weekEnd)
    .sort((a, b) => a.expiresAt!.localeCompare(b.expiresAt!));
  const grace = students.filter((x) => x.status === "grace");
  const requests = await db.select().from(schema.passwordRequests).where(eq(schema.passwordRequests.handled, false));
  const byUsername = new Map(students.map((x) => [x.username, x]));

  return (
    <>
      <h1 className="h1">{t("الملخص")}</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t("مفعّلون")} value={count("active")} tone="green" />
        <Stat label={t("في فترة السماح")} value={count("grace")} tone="amber" />
        <Stat label={t("موقوفون")} value={count("locked")} tone="rose" />
        <Stat label={t("تحصيل هذا الشهر")} value={money(Number(total ?? 0))} tone="blue" />
      </div>

      {requests.length > 0 && (
        <section className="card border-rose-200">
          <h2 className="mb-3 font-bold">{t("طلبات «نسيت كلمة المرور»")}</h2>
          <ul className="divide-y divide-slate-100">
            {requests.map((r) => {
              const st = byUsername.get(r.username);
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                  <span className="flex-1">
                    {st ? <Link className="font-semibold text-blue-800 underline" href={`/t/students/${st.id}`}>{st.fullName}</Link>
                      : <span className="text-slate-500">{t("اسم مستخدم غير موجود")}</span>}
                    <span className="mx-2 text-slate-400" dir="ltr">{r.username}</span>
                    <span className="text-slate-400">{dateTime(r.createdAt)}</span>
                  </span>
                  <form action={dismissRequest.bind(null, r.id)}><button className="btn-light">{t("تجاهل")}</button></form>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="card">
        <h2 className="mb-1 font-bold">{t("ينتهي اشتراكهم خلال أسبوع")}</h2>
        <p className="muted mb-3">{t("تواصل مع ولي الأمر قبل الإيقاف.")}</p>
        <StudentMiniList rows={expiring} s={s} empty={t("لا يوجد")} />
      </section>

      {grace.length > 0 && (
        <section className="card">
          <h2 className="mb-1 font-bold">{t("في فترة السماح الآن")}</h2>
          <p className="muted mb-3">{t("سيتوقف حسابهم تلقائيًا بعد")} {s.graceDays} {t("يوم من تاريخ الانتهاء.")}</p>
          <StudentMiniList rows={grace} s={s} empty="" />
        </section>
      )}
    </>
  );
}

async function StudentMiniList({ rows, s, empty }: {
  rows: Awaited<ReturnType<typeof listStudents>>; s: schema.Settings; empty: string;
}) {
  const { t, date } = await getI18n();
  const gradeLabel = await gradeMap();
  if (!rows.length) return <p className="muted">{empty}</p>;
  return (
    <ul className="divide-y divide-slate-100">
      {rows.map((x) => (
        <li key={x.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
          <Link href={`/t/students/${x.id}`} className="font-semibold text-blue-800 underline">{x.fullName}</Link>
          <span className="text-slate-500">{t(gradeLabel[x.grade ?? 0] ?? "—")}</span>
          <StatusBadge status={x.status} />
          <span className="flex-1 text-slate-500">{t("ينتهي")} {date(x.expiresAt)}</span>
          {x.parentPhone && (
            <a className="btn-light" target="_blank" href={whatsappLink(x.parentPhone,
              t("السلام عليكم، نذكّركم بأن اشتراك {name} في {platform} ينتهي يوم {date}.", { name: x.fullName, platform: s.platformName, date: date(x.expiresAt) }))}>
              {t("واتساب ولي الأمر")}
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
