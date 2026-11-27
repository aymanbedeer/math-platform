"use client";
import { useActionState, useState } from "react";
import { useI18n } from "@/i18n/client";
import type { TaskMsg } from "@/app/actions/tasks";
import { KIND_LABEL, type Kind } from "@/lib/task-kinds";

export type EditorQuestion = { kind: Kind; prompt: string; options: string[]; correct: (number | string)[]; points: number };
export type EditorTask = {
  title: string; instructions: string; gradeId: number; groupId: number | null; dueAt: string | null;
  allowLate: boolean; showAnswers: boolean; published: boolean; questions: EditorQuestion[];
};


const blank = (kind: Kind): EditorQuestion => ({
  kind, prompt: "", points: kind === "essay" || kind === "file" ? 5 : 1,
  options: kind === "single" || kind === "multi" ? ["", ""] : [],
  correct: kind === "truefalse" ? [1] : [],
});

/** ISO time -> value for <input type="datetime-local"> in the browser's time zone. */
function toLocal(iso: string | null) {
  const d = iso ? new Date(iso) : new Date(Date.now() + 7 * 86400000);
  if (!iso) d.setHours(22, 0, 0, 0);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function TaskEditor({ initial, grades, groups, locked, action }: {
  initial: EditorTask | null; grades: { id: number; name: string }[]; groups: { id: number; name: string; gradeId: number }[];
  locked: boolean; action: (s: TaskMsg, f: FormData) => Promise<TaskMsg>;
}) {
  const { t } = useI18n();
  const [state, run, pending] = useActionState(action, undefined);
  const [task, setTask] = useState<EditorTask>(initial ?? {
    title: "", instructions: "", gradeId: grades[0]?.id ?? 0, groupId: null, dueAt: null,
    allowLate: false, showAnswers: true, published: false, questions: [],
  });
  const [due, setDue] = useState(toLocal(initial?.dueAt ?? null));
  const set = (p: Partial<EditorTask>) => setTask((x) => ({ ...x, ...p }));
  const setQ = (i: number, p: Partial<EditorQuestion>) =>
    set({ questions: task.questions.map((q, j) => (j === i ? { ...q, ...p } : q)) });
  const move = (i: number, d: number) => {
    const qs = [...task.questions]; const j = i + d;
    if (j < 0 || j >= qs.length) return;
    [qs[i], qs[j]] = [qs[j], qs[i]]; set({ questions: qs });
  };
  const total = task.questions.reduce((n, q) => n + (Number(q.points) || 0), 0);
  const data = JSON.stringify({ ...task, dueAt: due ? new Date(due).toISOString() : "" });
  const gradeGroups = groups.filter((g) => g.gradeId === task.gradeId);

  return (
    <form action={run} className="space-y-4">
      <input type="hidden" name="data" value={data} />
      <section className="card space-y-3">
        <div>
          <label className="label">{t("عنوان المهمة *")}</label>
          <input className="input" value={task.title} onChange={(e) => set({ title: e.target.value })} required maxLength={200}
            placeholder={t("مثل: واجب الاشتقاق الأول")} />
        </div>
        <div>
          <label className="label">{t("التعليمات (اختياري)")}</label>
          <textarea className="input min-h-20" value={task.instructions} onChange={(e) => set({ instructions: e.target.value })} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label">{t("الصف")}</label>
            <select className="input" value={task.gradeId} onChange={(e) => set({ gradeId: Number(e.target.value), groupId: null })}>
              {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{t("المجموعة")}</label>
            <select className="input" value={task.groupId ?? ""} onChange={(e) => set({ groupId: e.target.value ? Number(e.target.value) : null })}>
              <option value="">{t("كل مجموعات الصف")}</option>
              {gradeGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{t("موعد التسليم *")}</label>
            <input type="datetime-local" className="input" value={due} onChange={(e) => setDue(e.target.value)} required />
          </div>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4" checked={task.allowLate} onChange={(e) => set({ allowLate: e.target.checked })} />{t("السماح بالتسليم المتأخر")}</label>
          <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4" checked={task.showAnswers} onChange={(e) => set({ showAnswers: e.target.checked })} />{t("إظهار الإجابات الصحيحة للطلاب بعد موعد التسليم")}</label>
        </div>
      </section>

      {locked && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{t("سلّم بعض الطلاب هذه المهمة، لذلك لا يمكن تغيير الأسئلة. يمكنك تعديل العنوان والموعد والتعليمات.")}</p>}

      {task.questions.map((q, i) => (
        <section key={i} className="card space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge bg-blue-100 text-blue-800">{t("سؤال {n}", { n: i + 1 })}</span>
            <span className="text-sm font-semibold text-slate-600">{t(KIND_LABEL[q.kind])}</span>
            <span className="flex-1" />
            {!locked && <>
              <button type="button" className="btn-light px-2" onClick={() => move(i, -1)} aria-label={t("لأعلى")}>↑</button>
              <button type="button" className="btn-light px-2" onClick={() => move(i, 1)} aria-label={t("لأسفل")}>↓</button>
              <button type="button" className="btn-light px-2 text-red-600" onClick={() => set({ questions: task.questions.filter((_, j) => j !== i) })}>{t("حذف")}</button>
            </>}
          </div>
          <textarea className="input min-h-16" value={q.prompt} disabled={locked} onChange={(e) => setQ(i, { prompt: e.target.value })}
            placeholder={q.kind === "file" ? t("مثل: حل تمارين صفحة 45 وارفع صورة الحل") : t("نص السؤال")} />

          {(q.kind === "single" || q.kind === "multi") && (
            <div className="space-y-2">
              <p className="muted text-xs">{q.kind === "single" ? t("اختر الإجابة الصحيحة بالدائرة.") : t("علّم كل الإجابات الصحيحة.")}</p>
              {q.options.map((o, k) => (
                <div key={k} className="flex items-center gap-2">
                  <input type={q.kind === "single" ? "radio" : "checkbox"} className="h-4 w-4" disabled={locked}
                    checked={q.correct.includes(k)} aria-label={t("صحيحة")}
                    onChange={(e) => setQ(i, { correct: q.kind === "single" ? [k] : e.target.checked ? [...q.correct, k] : q.correct.filter((c) => c !== k) })} />
                  <input className="input flex-1" value={o} disabled={locked} placeholder={t("اختيار {n}", { n: k + 1 })}
                    onChange={(e) => setQ(i, { options: q.options.map((x, m) => (m === k ? e.target.value : x)) })} />
                  {!locked && q.options.length > 2 && (
                    <button type="button" className="btn-light px-2" aria-label={t("حذف")} onClick={() => setQ(i, {
                      options: q.options.filter((_, m) => m !== k),
                      correct: q.correct.filter((c) => c !== k).map((c) => (Number(c) > k ? Number(c) - 1 : c)),
                    })}>×</button>
                  )}
                </div>
              ))}
              {!locked && q.options.length < 10 && <button type="button" className="btn-light" onClick={() => setQ(i, { options: [...q.options, ""] })}>{t("+ اختيار")}</button>}
            </div>
          )}
          {q.kind === "truefalse" && (
            <div className="flex gap-4 text-sm">
              <span className="muted">{t("الإجابة الصحيحة:")}</span>
              <label className="flex items-center gap-1"><input type="radio" disabled={locked} checked={q.correct[0] === 1} onChange={() => setQ(i, { correct: [1] })} />{t("صح")}</label>
              <label className="flex items-center gap-1"><input type="radio" disabled={locked} checked={q.correct[0] === 0} onChange={() => setQ(i, { correct: [0] })} />{t("خطأ")}</label>
            </div>
          )}
          {q.kind === "short" && (
            <div>
              <label className="label">{t("الإجابات المقبولة (اختياري، واحدة في كل سطر)")}</label>
              <textarea className="input min-h-14" disabled={locked} value={q.correct.join("\n")}
                onChange={(e) => setQ(i, { correct: e.target.value.split("\n") })} />
              <p className="muted mt-1 text-xs">{t("إذا كتبتها تُصحَّح تلقائيًا، وإلا تصححها أنت.")}</p>
            </div>
          )}
          {(q.kind === "essay" || q.kind === "file") && (
            <p className="muted text-xs">{q.kind === "file"
              ? t("يرفع الطالب صورًا أو ملفات PDF أو Word أو غيرها، وتصححها أنت.")
              : t("يكتب الطالب إجابته، وتصححها أنت.")}</p>
          )}
          <label className="flex items-center gap-2 text-sm">
            {t("الدرجة")}
            <input type="number" min={0} max={100} className="input w-20" disabled={locked} value={q.points}
              onChange={(e) => setQ(i, { points: Number(e.target.value) })} />
          </label>
        </section>
      ))}

      {!locked && (
        <section className="card">
          <p className="mb-2 text-sm font-semibold">{t("إضافة سؤال")}</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
              <button key={k} type="button" className="btn-light" onClick={() => set({ questions: [...task.questions, blank(k)] })}>+ {t(KIND_LABEL[k])}</button>
            ))}
          </div>
        </section>
      )}

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-2 border-t border-slate-200 bg-white/95 py-3 backdrop-blur">
        <span className="muted flex-1 text-sm">{t("{n} سؤال · المجموع {p} درجة", { n: task.questions.length, p: total })}</span>
        {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
        <button name="mode" value="draft" className="btn-light" disabled={pending}>{t("حفظ كمسودة")}</button>
        <button name="mode" value="publish" className="btn-primary" disabled={pending}>{pending ? t("جارٍ...") : t("نشر للطلاب")}</button>
      </div>
    </form>
  );
}
