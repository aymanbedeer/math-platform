import LogoMark from "@/components/logo";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getSettings, requireTeacher } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import LangSwitch from "@/components/lang-switch";
import { getI18n } from "@/i18n/server";
import Brand from "@/components/brand";
import { Bell } from "@/components/notifications";
import { unreadCount } from "@/lib/notify";


export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getI18n();
  const me = await requireTeacher();
  const s = await getSettings();
  const nav = [
  ["/t", t("الملخص")],
  ["/t/students", t("الطلاب")],
  ["/t/classes", t("الصفوف والمجموعات")],
  ["/t/content", t("المحتوى")],
  ["/t/tasks", t("المهام")],
  ["/t/announcements", t("الإعلانات")],
  ["/t/reports", t("التقارير")],
  ["/t/settings", t("الإعدادات")],
  ];
  const reqs = await db.$count(schema.passwordRequests, eq(schema.passwordRequests.handled, false));
  const unread = await unreadCount(me.id);
  const toMark = await db.$count(schema.taskSubmissions, eq(schema.taskSubmissions.graded, false));
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-800 text-white md:h-14 md:w-14 md:rounded-2xl"><LogoMark className="h-6 w-6 md:h-9 md:w-9" /></div>
          <div className="min-w-0 flex-1">
            <Brand name={s.platformName} />
            <div className="text-xs text-slate-500">{t("لوحة تحكم المعلم")} · {me.fullName}</div>
          </div>
          <Bell href="/t/notifications" unread={unread} />
          <Link href="/t/profile" className="btn-light" title={t("ملفي الشخصي")}>👤<span className="hidden sm:inline">{t("ملفي الشخصي")}</span></Link>
          <LangSwitch />
          <form action={logout}><button className="btn-light" aria-label={t("خروج")} title={t("خروج")}><svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 sm:hidden rtl:-scale-x-100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></svg><span className="hidden sm:inline">{t("خروج")}</span></button></form>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 pb-2">
          {nav.map(([href, label]) => (
            <Link key={href} href={href} className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100">
              {label}
              {href === "/t" && reqs > 0 && <span className="badge ms-1 bg-rose-600 text-white">{reqs}</span>}
              {href === "/t/tasks" && toMark > 0 && <span className="badge ms-1 bg-amber-500 text-white">{toMark}</span>}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">{children}</main>
    </div>
  );
}
