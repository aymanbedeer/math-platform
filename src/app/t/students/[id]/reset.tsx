"use client";
import { useActionState } from "react";
import { resetPassword } from "@/app/actions/teacher";
import { SubmitButton } from "@/components/client";
import { Credentials } from "@/components/credentials";
import { useI18n } from "@/i18n/client";

export default function ResetPassword({ id, loginUrl }: { id: number; loginUrl: string }) {
  const { t } = useI18n();
  const [state, action] = useActionState(resetPassword.bind(null, id), undefined);
  return (
    <div className="space-y-2">
      <form action={action}>
        <SubmitButton className="btn-light" confirm={t("توليد كلمة مرور جديدة وإخراج الطالب من كل الأجهزة؟")}>{t("إعادة تعيين كلمة المرور")}</SubmitButton>
      </form>
      {state?.password && <Credentials name={state.name} username={state.username!} password={state.password} loginUrl={loginUrl} />}
    </div>
  );
}
