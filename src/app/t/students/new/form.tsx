"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { createStudent } from "@/app/actions/teacher";
import { SubmitButton } from "@/components/client";
import { Credentials } from "@/components/credentials";
import { useI18n } from "@/i18n/client";
import GradeGroupFields from "@/components/grade-group";

export default function NewStudentForm({ fee, loginUrl, groups, grades }: { fee: number; loginUrl: string; groups: { id: number; name: string; gradeId: number }[]; grades: { id: number; name: string }[] }) {
  const { t } = useI18n();
  const [state, action] = useActionState(createStudent, undefined);
  const [months, setMonths] = useState(1);

  if (state?.username && state.password) {
    return (
      <div className="card max-w-lg space-y-4">
        <p className="font-semibold">{t("تمت إضافة")} {state.name} ✓</p>
        <Credentials name={state.name} username={state.username} password={state.password} loginUrl={loginUrl} />
        <div className="flex gap-2">
          <button type="button" onClick={() => window.location.reload()} className="btn-primary">{t("إضافة طالب آخر")}</button>
          <Link href="/t/students" className="btn-light">{t("قائمة الطلاب")}</Link>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="card max-w-lg space-y-4">
      <div>
        <label className="label">{t("اسم الطالب *")}</label>
        <input name="fullName" className="input" required />
      </div>
      <div>
        <GradeGroupFields grades={grades} groups={groups}
          labels={{ grade: t("الصف *"), group: t("المجموعة"), none: t("بدون مجموعة"), empty: t("لا توجد مجموعات لهذا الصف") }} />
        <p className="muted mt-1">{t("تضيف المجموعات الجديدة من صفحة «الصفوف والمجموعات».")}</p>
      </div>
      <div>
        <label className="label">{t("رقم ولي الأمر")}</label>
        <input name="parentPhone" className="input" dir="ltr" inputMode="tel" />
      </div>
      <div>
        <label className="label">{t("اسم المستخدم (اختياري)")}</label>
        <input name="username" className="input" dir="ltr" placeholder={t("يُولَّد تلقائيًا مثل s1001")} autoCapitalize="none" />
        <p className="muted mt-1">{t("حروف إنجليزية وأرقام فقط. كلمة المرور المؤقتة تُولَّد تلقائيًا.")}</p>
      </div>
      <fieldset className="rounded-xl border border-slate-200 p-3">
        <legend className="px-1 text-sm font-semibold">{t("الدفع الأول (اختياري)")}</legend>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="label">{t("الأشهر")}</label>
            <input name="months" type="number" min={0} max={12} value={months} onChange={(e) => setMonths(+e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">{t("المبلغ")}</label>
            <input name="amount" type="number" min={0} key={months} defaultValue={fee * months} className="input" />
          </div>
          <div>
            <label className="label">{t("الطريقة")}</label>
            <select name="method" className="input"><option value="cash">{t("نقدًا")}</option><option value="transfer">{t("تحويل")}</option></select>
          </div>
        </div>
        <p className="muted mt-2">{t("اجعل الأشهر 0 إذا لم يدفع بعد (سيكون الحساب موقوفًا حتى تسجّل الدفع).")}</p>
      </fieldset>
      {state?.error && <p className="text-sm text-rose-700">{state.error}</p>}
      <SubmitButton>{t("إضافة وتوليد بيانات الدخول")}</SubmitButton>
    </form>
  );
}
