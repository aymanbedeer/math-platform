"use client";
import { useActionState } from "react";
import { changeOwnPassword } from "@/app/actions/auth";
import { SubmitButton } from "./client";
import { useI18n } from "@/i18n/client";

export default function PasswordForm() {
  const { t } = useI18n();
  const [state, action] = useActionState(changeOwnPassword, undefined);
  return (
    <form action={action} className="space-y-3">
      <input name="old" type="password" className="input" placeholder={t("كلمة المرور الحالية")} dir="ltr" autoComplete="current-password" required />
      <input name="new" type="password" className="input" placeholder={t("كلمة المرور الجديدة (6 أحرف على الأقل)")} dir="ltr" autoComplete="new-password" required />
      <input name="confirm" type="password" className="input" placeholder={t("تأكيد كلمة المرور الجديدة")} dir="ltr" autoComplete="new-password" required />
      {state?.error && <p className="text-sm text-rose-700">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-700">{state.ok}</p>}
      <SubmitButton>{t("تغيير كلمة المرور")}</SubmitButton>
    </form>
  );
}
