"use client";
import { CopyButton } from "./client";
import { useI18n } from "@/i18n/client";

export function Credentials({ name, username, password, loginUrl }: { name?: string; username: string; password: string; loginUrl: string }) {
  const { t } = useI18n();
  const text = t("بيانات دخول {name} على المنصة:\nالرابط: {url}\nاسم المستخدم: {username}\nكلمة المرور: {password}", { name: name ?? "", url: loginUrl, username, password });
  return (
    <div className="rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50 p-4">
      <p className="mb-2 text-sm font-semibold text-emerald-900">{t("انسخ البيانات الآن وسلّمها للطالب. لن تظهر كلمة المرور مرة أخرى.")}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-slate-600">{t("اسم المستخدم")}</dt><dd dir="ltr" className="text-end font-mono font-bold">{username}</dd>
        <dt className="text-slate-600">{t("كلمة المرور")}</dt><dd dir="ltr" className="text-end font-mono font-bold">{password}</dd>
      </dl>
      <div className="mt-3"><CopyButton text={text} label={t("نسخ رسالة البيانات")} /></div>
    </div>
  );
}
