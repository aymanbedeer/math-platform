"use client";
import { useActionState } from "react";
import { login } from "@/app/actions/auth";
import { SubmitButton } from "@/components/client";
import { useI18n } from "@/i18n/client";

export default function LoginForm() {
  const { t } = useI18n();
  const [state, action] = useActionState(login, undefined);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="username">{t("اسم المستخدم")}</label>
        <input id="username" name="username" className="input" autoComplete="username" dir="ltr" autoCapitalize="none" required />
      </div>
      <div>
        <label className="label" htmlFor="password">{t("كلمة المرور")}</label>
        <input id="password" name="password" type="password" className="input" autoComplete="current-password" dir="ltr" required />
      </div>
      {state?.error && <p className="text-sm text-rose-700">{state.error}</p>}
      <SubmitButton className="btn-primary w-full py-3">{t("دخول")}</SubmitButton>
    </form>
  );
}
