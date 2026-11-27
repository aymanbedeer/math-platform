"use client";
import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset } from "@/app/actions/auth";
import { SubmitButton } from "@/components/client";
import { useI18n } from "@/i18n/client";

export default function ForgotPage() {
  const { t } = useI18n();
  const [state, action] = useActionState(requestPasswordReset, undefined);
  return (
    <div className="auth-bg">
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <div className="card space-y-4">
        <h1 className="h1">{t("نسيت كلمة المرور")}</h1>
        <p className="muted">{t("اكتب اسم المستخدم، وسيصل طلبك إلى الأستاذ ليعطيك كلمة مرور جديدة.")}</p>
        {state?.ok ? (
          <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{state.ok}</p>
        ) : (
          <form action={action} className="space-y-4">
            <input name="username" className="input" placeholder={t("اسم المستخدم")} dir="ltr" autoCapitalize="none" required />
            {state?.error && <p className="text-sm text-rose-700">{state.error}</p>}
            <SubmitButton className="btn-primary w-full">{t("إرسال الطلب")}</SubmitButton>
          </form>
        )}
        <Link href="/login" className="block text-center text-sm text-blue-800 underline">{t("العودة لتسجيل الدخول")}</Link>
      </div>
    </main>
    </div>
  );
}
