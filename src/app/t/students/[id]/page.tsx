import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { getSettings } from "@/lib/auth";
import { addDays } from "@/lib/dates";
import { paymentPeriod, subscriptionStatus } from "@/lib/subscription";
import { gradeMap, getGrades, getGroups } from "@/lib/grades";
import GradeGroupFields from "@/components/grade-group";
import { studentPayments } from "@/lib/students";
import { StatusBadge, whatsappLink } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import {
  activateStudent, deleteStudent, endSessions, extendStudent, removeDevice, recordPayment, setExempt, suspendStudent, updateStudent,
} from "@/app/actions/teacher";
import ResetPassword from "./reset";
import { getI18n } from "@/i18n/server";

const eventLabel: Record<string, string> = {
  created: "إنشاء الحساب", payment: "دفع", suspend: "إيقاف", activate: "تفعيل", exempt: "إعفاء",
  unexempt: "إلغاء الإعفاء", extend: "تمديد", password_reset: "إعادة تعيين كلمة المرور", sessions_ended: "إنهاء الجلسات",
  device_registered: "تسجيل جهاز", device_removed: "إزالة جهاز", device_blocked: "محاولة دخول من جهاز آخر (مُنعت)",
};

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { t, date, dateTime, money } = await getI18n();
  const gradeLabel = await gradeMap();
  const grades = await getGrades();
  const allGroups = await getGroups();
  const id = Number((await params).id);
  const [st] = await db.select().from(schema.users).where(and(eq(schema.users.id, id), eq(schema.users.role, "student")));
  if (!st) notFound();
  const s = await getSettings();
  const status = subscriptionStatus(st, s.graceDays);
  const payments = await studentPayments(id);
  const events = await db.select().from(schema.accountEvents).where(eq(schema.accountEvents.studentId, id)).orderBy(desc(schema.accountEvents.createdAt));
  const sessions = await db.select().from(schema.sessions).where(eq(schema.sessions.userId, id)).orderBy(desc(schema.sessions.lastSeenAt)).limit(10);
  const openSessions = sessions.filter((x) => !x.revokedAt);
  const devices = await db.select().from(schema.devices).where(eq(schema.devices.userId, id)).orderBy(desc(schema.devices.createdAt));
  const nextPeriod = paymentPeriod(st, 1, s.graceDays);

  // progress
  const lessonIds = (await db.select({ id: schema.lessons.id }).from(schema.lessons)
    .innerJoin(schema.units, eq(schema.units.id, schema.lessons.unitId))
    .where(and(eq(schema.units.grade, st.grade ?? 0), ne(schema.lessons.status, "draft")))).map((r) => r.id);
  const done = lessonIds.length
    ? await db.$count(schema.completions, and(eq(schema.completions.studentId, id), inArray(schema.completions.lessonId, lessonIds)))
    : 0;

  const h = await headers();
  const loginUrl = `${h.get("x-forwarded-proto") || "https"}://${h.get("host")}/login`;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="h1">{st.fullName}</h1>
        <StatusBadge status={status} />
        {st.exempt && <span className="badge bg-blue-100 text-blue-800">{t("معفى من الدفع")}</span>}
        {st.suspended && <span className="badge bg-slate-200 text-slate-700">{t("موقوف يدويًا:")} {st.suspendReason}</span>}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card space-y-2 text-sm">
          <Row k={t("اسم المستخدم")} v={<span dir="ltr" className="font-mono">{st.username}</span>} />
          <Row k={t("الصف")} v={t(gradeLabel[st.grade ?? 0] ?? "—")} />
          <Row k={t("المجموعة")} v={allGroups.find((g) => g.id === st.groupId)?.name || "—"} />
          <Row k={t("رقم ولي الأمر")} v={st.parentPhone ? (
            <a className="text-blue-800 underline" dir="ltr" target="_blank" href={whatsappLink(st.parentPhone)}>{st.parentPhone}</a>
          ) : "—"} />
          <Row k={t("هاتف الطالب")} v={st.phone ? <a className="text-blue-800 underline" dir="ltr" target="_blank" href={whatsappLink(st.phone)}>{st.phone}</a> : "—"} />
          <Row k={t("البريد الإلكتروني")} v={st.email ? <a className="text-blue-800 underline break-all" dir="ltr" href={`mailto:${st.email}`}>{st.email}</a> : "—"} />
          <Row k={t("ينتهي الاشتراك")} v={st.exempt ? t("معفى") : date(st.expiresAt)} />
          {st.expiresAt && !st.exempt && s.graceDays > 0 && <Row k={t("آخر يوم في السماح")} v={date(addDays(st.expiresAt, s.graceDays))} />}
          <Row k={t("آخر دخول")} v={dateTime(st.lastSeenAt)} />
          <Row k={t("التقدم")} v={t("{done} من {total} درس", { done, total: lessonIds.length })} />
        </section>

        <section id="pay" className="card lg:col-span-2">
          <h2 className="mb-1 font-bold">{t("تسجيل دفع")}</h2>
          <p className="muted mb-3">{t("شهر واحد يمدّ الاشتراك من")} {date(nextPeriod.from)} {t("حتى")} {date(nextPeriod.to)}.</p>
          <form action={recordPayment.bind(null, id)} className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <div><label className="label">{t("الأشهر")}</label>
              <select name="months" className="input">{[1, 2, 3, 4, 5, 6, 9, 12].map((m) => <option key={m} value={m}>{m}</option>)}</select></div>
            <div><label className="label">{t("المبلغ")}</label><input name="amount" type="number" min={0} defaultValue={s.monthlyFee} className="input" required /></div>
            <div><label className="label">{t("الطريقة")}</label>
              <select name="method" className="input"><option value="cash">{t("نقدًا")}</option><option value="transfer">{t("تحويل")}</option></select></div>
            <div><label className="label">{t("ملاحظة")}</label><input name="note" className="input" /></div>
            <div className="flex items-end"><SubmitButton className="btn-green w-full">{t("تسجيل الدفع")}</SubmitButton></div>
          </form>
          <p className="muted mt-2">{t("إذا دفع أكثر من شهر، غيّر عدد الأشهر واكتب المبلغ الكلي.")}</p>
        </section>
      </div>

      <section className="card">
        <h2 className="mb-3 font-bold">{t("إجراءات")}</h2>
        <div className="flex flex-wrap items-start gap-3">
          {st.suspended ? (
            <form action={activateStudent.bind(null, id)}><SubmitButton className="btn-green">{t("تفعيل (إلغاء الإيقاف)")}</SubmitButton></form>
          ) : (
            <form action={suspendStudent.bind(null, id)} className="flex gap-2">
              <input name="reason" placeholder={t("سبب الإيقاف")} className="input w-44" />
              <SubmitButton className="btn-danger">{t("إيقاف")}</SubmitButton>
            </form>
          )}
          <form action={extendStudent.bind(null, id)} className="flex gap-2">
            <input name="days" type="number" min={1} max={90} defaultValue={7} className="input w-20" />
            <SubmitButton className="btn-light">{t("تمديد المهلة (أيام)")}</SubmitButton>
          </form>
          <form action={setExempt.bind(null, id, !st.exempt)}>
            <SubmitButton className="btn-light">{st.exempt ? t("إلغاء الإعفاء") : t("إعفاء من الدفع")}</SubmitButton>
          </form>
          <form action={endSessions.bind(null, id)}>
            <SubmitButton className="btn-light">{t("إنهاء الجلسات المفتوحة (")}{openSessions.length})</SubmitButton>
          </form>
          <ResetPassword id={id} loginUrl={loginUrl} />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card overflow-x-auto">
          <h2 className="mb-3 font-bold">{t("سجل المدفوعات")}</h2>
          <table className="tbl">
            <thead><tr><th>{t("التاريخ")}</th><th>{t("المبلغ")}</th><th>{t("الطريقة")}</th><th>{t("الفترة")}</th></tr></thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="whitespace-nowrap">{date(p.createdAt)}</td>
                  <td>{money(p.amount)}</td>
                  <td>{p.method === "cash" ? t("نقدًا") : t("تحويل")}</td>
                  <td className="whitespace-nowrap text-xs">{date(p.periodFrom)} – {date(p.periodTo)}{p.note && <div className="text-slate-500">{p.note}</div>}</td>
                </tr>
              ))}
              {!payments.length && <tr><td colSpan={4} className="text-slate-500">{t("لا توجد مدفوعات")}</td></tr>}
            </tbody>
          </table>
        </section>
        <section className="card">
          <h2 className="mb-3 font-bold">{t("سجل الحساب")}</h2>
          <ul className="max-h-80 space-y-2 overflow-y-auto text-sm">
            {events.map((e) => (
              <li key={e.id} className="flex gap-2">
                <span className="whitespace-nowrap text-slate-400">{dateTime(e.createdAt)}</span>
                <span className="font-semibold">{eventLabel[e.kind] ? t(eventLabel[e.kind]) : e.kind}</span>
                {e.note && <span className="text-slate-600">{e.note}</span>}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-3 font-bold">{s.maxDevices === 1 ? t("الجهاز المسجّل") : t("الأجهزة المسجّلة")}</h2>
          <p className="muted mb-3">{s.maxDevices === 1
            ? t("الطالب يفتح المنصة من هذا الجهاز فقط. لينتقل إلى جهاز آخر، أزل هذا الجهاز ثم يسجّل الدخول من الجهاز الجديد.")
            : t("مسموح {n} أجهزة. لينتقل الطالب إلى جهاز آخر، أزل أحد الأجهزة.", { n: s.maxDevices })}</p>
          <ul className="space-y-2 text-sm">
            {devices.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 p-3">
                <div className="flex-1">
                  <div className="font-semibold">{d.name || t("جهاز")}</div>
                  <div className="muted text-xs">{t("سُجّل في")} {dateTime(d.createdAt)} {t("· آخر نشاط")} {dateTime(d.lastSeenAt)}</div>
                </div>
                <form action={removeDevice.bind(null, id, d.id)}>
                  <SubmitButton className="btn-danger" confirm={t("إزالة هذا الجهاز؟ سيخرج الطالب منه، ويمكنه بعدها الدخول من جهاز جديد.")}>{t("إزالة الجهاز")}</SubmitButton>
                </form>
              </li>
            ))}
            {!devices.length && <li className="text-slate-500">{t("لا يوجد جهاز مسجّل. أول جهاز يدخل منه الطالب سيُسجَّل تلقائيًا.")}</li>}
          </ul>
        </section>
        <section className="card">
          <h2 className="mb-3 font-bold">{t("تعديل البيانات")}</h2>
          <form action={updateStudent.bind(null, id)} className="space-y-3">
            <label className="label">{t("اسم الطالب *")}</label>
            <input name="fullName" defaultValue={st.fullName} className="input" required />
            <GradeGroupFields grades={grades.map((g) => ({ id: g.id, name: t(g.name) }))} groups={allGroups} grade={st.grade} group={st.groupId}
              labels={{ grade: t("الصف"), group: t("المجموعة"), none: t("بدون مجموعة"), empty: t("لا توجد مجموعات لهذا الصف") }} />
            <label className="label">{t("رقم ولي الأمر")}</label>
            <input name="parentPhone" defaultValue={st.parentPhone ?? ""} className="input" dir="ltr" />
            <SubmitButton className="btn-light">{t("حفظ")}</SubmitButton>
          </form>
          <form action={deleteStudent.bind(null, id)} className="mt-6 border-t border-slate-100 pt-4">
            <SubmitButton className="btn-danger" confirm={t("حذف {name} نهائيًا مع كل مدفوعاته وسجله؟ لا يمكن التراجع.", { name: st.fullName })}>{t("حذف الطالب")}</SubmitButton>
          </form>
        </section>
      </div>
    </>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex justify-between gap-3"><span className="text-slate-500">{k}</span><span className="text-end font-medium">{v}</span></div>;
}
