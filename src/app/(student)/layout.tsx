import LogoMark from "@/components/logo";
import Link from "next/link";
import { requireStudent } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import LangSwitch from "@/components/lang-switch";
import { getI18n } from "@/i18n/server";
import Brand from "@/components/brand";
import { Bell } from "@/components/notifications";
import { unreadCount } from "@/lib/notify";
import { submissionsByStudent, taskState, tasksForStudent } from "@/lib/tasks";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getI18n();
  const { user, settings, canViewPaid } = await requireStudent();
  // Tasks still waiting for this student (open or late but allowed)
  let due = 0;
  if (canViewPaid) {
    const tasks = await tasksForStudent(user);
    const subs = await submissionsByStudent(user.id, tasks.map((x) => x.id));
    due = tasks.filter((x) => ["open", "late_open"].includes(taskState(x, subs.get(x.id)))).length;
  }
  const unread = await unreadCount(user.id);
  return (
    <div className="min-h-dvh pb-20 md:pb-0">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-800 text-white md:h-14 md:w-14 md:rounded-2xl"><LogoMark className="h-6 w-6 md:h-9 md:w-9" /></div>
          <div className="min-w-0 flex-1">
            <Brand name={settings.platformName} />
            <div className="truncate text-xs text-slate-500">{user.fullName}</div>
          </div>
          {canViewPaid && (
            <nav className="hidden gap-1 md:flex">
              <NavLink href="/">{t("الرئيسية")}</NavLink>
              <NavLink href="/lessons">{t("الدروس")}</NavLink>
              <NavLink href="/tasks">{t("المهام")}{due > 0 && <Count n={due} />}</NavLink>
              <NavLink href="/account">{t("حسابي")}</NavLink>
            </nav>
          )}
          <Bell href="/notifications" unread={unread} />
          <LangSwitch />
          <form action={logout}><button className="btn-light" aria-label={t("خروج")} title={t("خروج")}><svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 sm:hidden rtl:-scale-x-100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></svg><span className="hidden sm:inline">{t("خروج")}</span></button></form>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-5 px-4 py-5">{children}</main>
      {canViewPaid && (
        <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-slate-200 bg-white md:hidden">
          <BottomLink href="/" icon="⌂">{t("الرئيسية")}</BottomLink>
          <BottomLink href="/lessons" icon="▤">{t("الدروس")}</BottomLink>
          <BottomLink href="/tasks" icon="✎" count={due}>{t("المهام")}</BottomLink>
          <BottomLink href="/account" icon="◉">{t("حسابي")}</BottomLink>
        </nav>
      )}
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100">{children}</Link>;
}
function Count({ n }: { n: number }) {
  return <span className="ms-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">{n}</span>;
}
function BottomLink({ href, icon, count = 0, children }: { href: string; icon: string; count?: number; children: React.ReactNode }) {
  return (
    <Link href={href} className="relative flex flex-col items-center py-2 text-xs font-medium text-slate-700">
      <span className="text-lg leading-none">{icon}</span>{children}
      {count > 0 && <span className="absolute end-[22%] top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{count}</span>}
    </Link>
  );
}
