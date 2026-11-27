"use client";
import { useActionState, useState } from "react";
import { updateProfile } from "@/app/actions/auth";
import { SubmitButton } from "./client";
import { useI18n } from "@/i18n/client";

export default function ProfileForm({ fullName, email, phone, canEditName }: {
  fullName: string; email: string | null; phone: string | null; canEditName: boolean;
}) {
  const { t } = useI18n();
  const [state, action] = useActionState(updateProfile, undefined);
  // Controlled, so the fields keep what was typed after a submit (React resets uncontrolled forms).
  const [v, setV] = useState({ fullName, email: email ?? "", phone: phone ?? "" });
  const bind = (k: keyof typeof v) => ({ value: v[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value }) });
  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="label" htmlFor="pf-name">{t("الاسم")}</label>
        {canEditName
          ? <input id="pf-name" name="fullName" className="input" {...bind("fullName")} maxLength={100} required />
          : <><input id="pf-name" className="input bg-slate-50" value={fullName} disabled />
              <p className="muted mt-1 text-xs">{t("لتصحيح اسمك تواصل مع الأستاذ.")}</p></>}
      </div>
      <div>
        <label className="label" htmlFor="pf-email">{t("البريد الإلكتروني الشخصي (اختياري)")}</label>
        <input id="pf-email" name="email" type="email" className="input" dir="ltr" {...bind("email")} maxLength={200}
          autoComplete="email" placeholder="name@example.com" />
      </div>
      <div>
        <label className="label" htmlFor="pf-phone">{t("رقم هاتفك (اختياري)")}</label>
        <input id="pf-phone" name="phone" type="tel" className="input" dir="ltr" {...bind("phone")} maxLength={20}
          autoComplete="tel" placeholder="01xxxxxxxxx" />
      </div>
      {state?.error && <p className="text-sm text-rose-700">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-700">{state.ok}</p>}
      <SubmitButton>{t("حفظ البيانات")}</SubmitButton>
    </form>
  );
}
