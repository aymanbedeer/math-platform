import Link from "next/link";
import { getI18n } from "@/i18n/server";
import { NOTIFY_TEXT, listNotifications } from "@/lib/notify";
import { markAllRead, openNotification } from "@/app/actions/notifications";

/** Bell link with the unread count, for the page headers. */
export async function Bell({ href, unread }: { href: string; unread: number }) {
  const { t } = await getI18n();
  return (
    <Link href={href} aria-label={t("التنبيهات")} title={t("التنبيهات")}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-lg hover:bg-slate-50">
      <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-700" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {unread > 0 && (
        <span className="absolute -end-1.5 -top-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">{unread > 99 ? "99+" : unread}</span>
      )}
    </Link>
  );
}

/** Full history of a user's notifications, newest first, unread ones highlighted. */
export async function NotificationList({ userId }: { userId: number }) {
  const { t, dateTime } = await getI18n();
  const items = await listNotifications(userId);
  const unread = items.filter((n) => !n.readAt).length;
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="h1 flex-1">{t("التنبيهات")}</h1>
        {unread > 0 && <form action={markAllRead}><button className="btn-light">{t("تعليم الكل كمقروء")}</button></form>}
      </div>
      {!items.length && <p className="card muted">{t("لا توجد تنبيهات بعد")}</p>}
      {items.length > 0 && (
        <ul className="card divide-y divide-slate-100 p-0">
          {items.map((n) => {
            const tx = NOTIFY_TEXT[n.kind];
            const params = Object.fromEntries(Object.entries(n.params ?? {}).map(([k, v]) => [k, k === "due" && typeof v === "string" ? dateTime(new Date(v)) : v]));
            return (
              <li key={n.id}>
                <form action={openNotification.bind(null, n.id)}>
                  <button className={`flex w-full items-start gap-3 px-4 py-3 text-start hover:bg-slate-50 ${n.readAt ? "" : "bg-blue-50/60"}`}>
                    <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-800">{tx.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <b className="text-sm">{t(tx.title)}</b>
                        {!n.readAt && <span className="h-2 w-2 rounded-full bg-red-600" aria-label={t("جديد")} />}
                      </span>
                      <span className="block break-words text-sm text-slate-700">{t(tx.body, params)}</span>
                      <span className="muted block text-xs">{dateTime(n.createdAt)}</span>
                    </span>
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
