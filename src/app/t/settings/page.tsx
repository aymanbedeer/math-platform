import Link from "next/link";
import { getSettings } from "@/lib/auth";
import SettingsForm from "./form";
import { getI18n } from "@/i18n/server";

export default async function SettingsPage() {
  const { t } = await getI18n();
  const s = await getSettings();
  return (
    <>
      <h1 className="h1">{t("الإعدادات")}</h1>
      <SettingsForm s={s} />
      <p className="muted text-sm">{t("لتعديل اسمك وبريدك الإلكتروني وكلمة المرور افتح")} <Link className="text-blue-800 underline" href="/t/profile">{t("ملفي الشخصي")}</Link>.</p>
    </>
  );
}
