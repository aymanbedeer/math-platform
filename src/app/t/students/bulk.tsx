"use client";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import { SubmitButton } from "@/components/client";

/**
 * Bulk-edit bar for the students table. Lives inside the same <form> as the
 * row checkboxes (name="ids"); shows how many are selected and lets the
 * teacher move them to another group and/or grade in one step.
 */
export default function BulkBar({ groups, grades }: {
  groups: { grade: string; groups: { id: number; name: string }[] }[]; grades: { id: number; name: string }[];
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const boxes = () => Array.from(form.querySelectorAll<HTMLInputElement>('input[name="ids"]'));
    const update = () => { setCount(boxes().filter((b) => b.checked).length); setTotal(boxes().length); };
    update();
    form.addEventListener("change", update);
    return () => form.removeEventListener("change", update);
  }, []);

  const toggleAll = (on: boolean) => {
    const form = ref.current?.closest("form");
    form?.querySelectorAll<HTMLInputElement>('input[name="ids"]').forEach((b) => { b.checked = on; });
    form?.dispatchEvent(new Event("change"));
  };

  return (
    <div ref={ref} className="card flex flex-wrap items-end gap-3">
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" className="h-4 w-4" checked={total > 0 && count === total} onChange={(e) => toggleAll(e.target.checked)} />
        {count ? t("تم تحديد {n} طالب", { n: count }) : t("تحديد الكل")}
      </label>
      <div className="flex-1" />
      <div>
        <label className="label" title={t("اختيار مجموعة ينقل الطلاب إلى صفها أيضًا.")}>{t("نقل إلى المجموعة")}</label>
        <select name="group" className="input w-auto" defaultValue="" disabled={!count}>
          <option value="">{t("بدون تغيير")}</option>
          {groups.map((g) => (
            <optgroup key={g.grade} label={g.grade}>
              {g.groups.map((x) => <option key={x.id} value={x.id}>{g.grade} · {x.name}</option>)}
            </optgroup>
          ))}
        </select>
      </div>
      <div>
        <label className="label">{t("تغيير الصف")}</label>
        <select name="grade" className="input w-auto" defaultValue="" disabled={!count}>
          <option value="">{t("بدون تغيير")}</option>
          {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>
      <label className="flex items-center gap-2 pb-2 text-sm">
        <input type="checkbox" name="clearGroup" className="h-4 w-4" disabled={!count} />
        {t("إزالة من المجموعة")}
      </label>
      {count > 0 ? <SubmitButton>{t("تطبيق على المحدد")}</SubmitButton> : <button type="button" className="btn-primary" disabled>{t("تطبيق على المحدد")}</button>}
    </div>
  );
}
