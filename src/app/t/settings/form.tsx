"use client";
import { useActionState } from "react";
import type { Settings } from "@/db/schema";
import { saveSettings } from "@/app/actions/teacher";
import { SubmitButton } from "@/components/client";
import { useI18n } from "@/i18n/client";

export default function SettingsForm({ s }: { s: Settings }) {
  const { t } = useI18n();
  const [state, action] = useActionState(saveSettings, undefined);
  const field = (name: keyof Settings, label: string, hint?: string, type = "text", dir?: "ltr") => (
    <div>
      <label className="label">{label}</label>
      <input name={name} type={type} min={type === "number" ? 0 : undefined} defaultValue={String(s[name])} className="input" dir={dir} />
      {hint && <p className="muted mt-1">{hint}</p>}
    </div>
  );
  return (
    <form action={action} className="card max-w-lg space-y-4">
      {field("platformName", t("اسم المنصة"))}
      {field("teacherName", t("اسم المعلم"))}
      {field("whatsapp", t("رقم واتساب للتواصل"), t("يظهر للطالب الموقوف ليتواصل معك. مثال: 01012345678"), "tel", "ltr")}
      {field("monthlyFee", t("قيمة الاشتراك الشهري"), t("تُقترح تلقائيًا عند تسجيل الدفع"), "number")}
      {field("graceDays", t("مدة السماح بالأيام"), t("بعد انتهاء الاشتراك. اجعلها 0 للإيقاف الفوري."), "number")}
      {field("reminderDays", t("التذكير قبل الانتهاء بـ (أيام)"), t("يظهر شريط تنبيه للطالب"), "number")}
      {field("maxDevices", t("عدد الأجهزة المسموح لكل طالب"), t("يُسجَّل جهاز الطالب عند أول دخول، ويُمنع الدخول من غيره حتى تزيله من صفحة الطالب (من 1 إلى 5)"), "number")}
      {state?.ok && <p className="text-sm text-emerald-700">{state.ok}</p>}
      <SubmitButton>{t("حفظ الإعدادات")}</SubmitButton>
    </form>
  );
}
