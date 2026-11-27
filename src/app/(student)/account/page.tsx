import { redirect } from "next/navigation";
import { requireStudent } from "@/lib/auth";
import { studentCatalog } from "@/lib/content";
import { gradeMap } from "@/lib/grades";
import { studentPayments } from "@/lib/students";
import { StatusBadge } from "@/components/ui";
import PasswordForm from "@/components/password-form";
import ProfileForm from "@/components/profile-form";
import { getI18n } from "@/i18n/server";

export default async function Account() {
  const { t, date, money } = await getI18n();
  const gradeLabel = await gradeMap();
  const { user, status, canViewPaid } = await requireStudent();
  if (!canViewPaid) redirect("/");
  const { lessons, done } = await studentCatalog(user, canViewPaid);
  const finished = lessons.filter((l) => done.has(l.id)).length;
  const pct = lessons.length ? Math.round((finished / lessons.length) * 100) : 0;
  const payments = await studentPayments(user.id);

  return (
    <>
      <h1 className="h1">{t("حسابي")}</h1>
      <section className="card space-y-3">
        <div className="flex items-center justify-between"><span className="muted">{t("الاسم")}</span><span className="font-semibold">{user.fullName}</span></div>
        <div className="flex items-center justify-between"><span className="muted">{t("اسم المستخدم")}</span><span dir="ltr" className="font-mono">{user.username}</span></div>
        <div className="flex items-center justify-between"><span className="muted">{t("الصف")}</span><span>{t(gradeLabel[user.grade ?? 0] ?? "—")}</span></div>
        <div className="flex items-center justify-between"><span className="muted">{t("الاشتراك")}</span>
          <span className="flex items-center gap-2"><StatusBadge status={status} />{user.exempt ? t("معفى") : date(user.expiresAt)}</span></div>
      </section>

      <section id="profile" className="card">
        <h2 className="mb-3 font-bold">{t("بياناتي الشخصية")}</h2>
        <ProfileForm fullName={user.fullName} email={user.email} phone={user.phone} canEditName={false} />
      </section>

      <section className="card">
        <div className="mb-2 flex justify-between"><h2 className="font-bold">{t("تقدّمي")}</h2><span className="font-semibold">{pct}%</span></div>
        <div className="h-3 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
        </div>
        <p className="muted mt-2">{t("أنهيت {done} من {total} درس.", { done: finished, total: lessons.length })}</p>
      </section>

      <section className="card">
        <h2 className="mb-3 font-bold">{t("سجل المدفوعات")}</h2>
        <ul className="divide-y divide-slate-100 text-sm">
          {payments.map((p) => (
            <li key={p.id} className="flex justify-between gap-2 py-2">
              <span>{date(p.createdAt)}<span className="block text-xs text-slate-500">{t("من")} {date(p.periodFrom)} {t("إلى")} {date(p.periodTo)}</span></span>
              <span className="font-semibold">{money(p.amount)}</span>
            </li>
          ))}
          {!payments.length && <li className="text-slate-500">{t("لا توجد مدفوعات مسجّلة")}</li>}
        </ul>
      </section>

      <section className="card">
        <h2 className="mb-3 font-bold">{t("تغيير كلمة المرور")}</h2>
        <PasswordForm />
      </section>
    </>
  );
}
