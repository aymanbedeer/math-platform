"use client";
import { useActionState, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import type { TaskMsg } from "@/app/actions/tasks";
import type { Kind } from "@/lib/task-kinds";

type Q = { id: number; kind: Kind; prompt: string; options: string[]; points: number };
const MAX = 5 * 1024 * 1024;

/** Shrinks a photo to at most 1600px and JPEG, so phone pictures fit the upload limit. */
async function shrink(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 400 * 1024) return file;
  try {
    const img = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.82));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch { return file; }
}

export default function AnswerForm({ questions, action }: { questions: Q[]; action: (s: TaskMsg, f: FormData) => Promise<TaskMsg> }) {
  const { t } = useI18n();
  const [state, run, pending] = useActionState(action, undefined);
  const [files, setFiles] = useState<Record<number, File[]>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const form = useRef<HTMLFormElement>(null);
  const size = Object.values(files).flat().reduce((n, f) => n + f.size, 0);

  const pick = async (qid: number, list: FileList | null) => {
    if (!list) return;
    setBusy(true);
    const out = await Promise.all(Array.from(list).slice(0, 10).map(shrink));
    setFiles((x) => ({ ...x, [qid]: [...(x[qid] ?? []), ...out].slice(0, 10) }));
    setBusy(false);
  };

  const submit = (fd: FormData) => {
    setErr("");
    if (size > MAX) { setErr(t("حجم الملفات أكبر من 5 ميجابايت. صغّر الصور أو قسّم الملفات.")); return; }
    for (const [qid, list] of Object.entries(files)) list.forEach((f) => fd.append(`f_${qid}`, f, f.name));
    if (!window.confirm(t("تسليم الإجابات؟ لا يمكن تعديلها بعد التسليم."))) return;
    run(fd);
  };

  return (
    <form ref={form} action={submit} className="space-y-3">
      {questions.map((q, i) => (
        <section key={q.id} className="card space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="badge bg-blue-100 text-blue-800">{t("سؤال {n}", { n: i + 1 })}</span>
            <span className="flex-1" />
            <span className="muted">{t("{p} درجة", { p: q.points })}</span>
          </div>
          <p className="whitespace-pre-wrap font-semibold">{q.prompt}</p>
          {(q.kind === "single" || q.kind === "multi") && (
            <div className="space-y-1">
              {q.kind === "multi" && <p className="muted text-xs">{t("اختر كل الإجابات الصحيحة.")}</p>}
              {q.options.map((o, k) => (
                <label key={k} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 has-[:checked]:border-blue-400 has-[:checked]:bg-blue-50">
                  <input type={q.kind === "single" ? "radio" : "checkbox"} name={`q_${q.id}`} value={k} className="h-4 w-4" />
                  <span>{o}</span>
                </label>
              ))}
            </div>
          )}
          {q.kind === "truefalse" && (
            <div className="grid grid-cols-2 gap-2">
              {[[1, "صح"], [0, "خطأ"]].map(([v, l]) => (
                <label key={v} className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 py-3 font-semibold has-[:checked]:border-blue-400 has-[:checked]:bg-blue-50">
                  <input type="radio" name={`q_${q.id}`} value={v} className="h-4 w-4" />{t(String(l))}
                </label>
              ))}
            </div>
          )}
          {q.kind === "short" && <input name={`q_${q.id}`} className="input" maxLength={500} placeholder={t("إجابتك")} />}
          {q.kind === "essay" && <textarea name={`q_${q.id}`} className="input min-h-32" placeholder={t("اكتب إجابتك هنا")} />}
          {q.kind === "file" && (
            <div className="space-y-2">
              <label className="btn-light inline-flex cursor-pointer">
                📎 {t("اختر صورًا أو ملفات")}
                <input type="file" multiple className="hidden" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.rtf,.txt,.zip"
                  onChange={(e) => { pick(q.id, e.target.files); e.target.value = ""; }} />
              </label>
              <label className="btn-light ms-2 inline-flex cursor-pointer">
                📷 {t("تصوير")}
                <input type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={(e) => { pick(q.id, e.target.files); e.target.value = ""; }} />
              </label>
              <ul className="space-y-1 text-sm">
                {(files[q.id] ?? []).map((f, k) => (
                  <li key={k} className="flex items-center gap-2">
                    <span className="flex-1 truncate">{f.name}</span>
                    <span className="muted text-xs">{Math.max(1, Math.round(f.size / 1024))} KB</span>
                    <button type="button" className="text-red-600" aria-label={t("حذف")}
                      onClick={() => setFiles((x) => ({ ...x, [q.id]: x[q.id].filter((_, m) => m !== k) }))}>×</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ))}
      <div className="sticky bottom-16 z-10 space-y-2 rounded-2xl border border-slate-200 bg-white/95 p-3 backdrop-blur md:bottom-0">
        {size > 0 && <p className={`text-xs ${size > MAX ? "text-red-600" : "muted"}`}>{t("حجم الملفات: {a} من 5 ميجابايت", { a: (size / 1048576).toFixed(1) })}</p>}
        {(err || state?.error) && <p className="text-sm text-red-600">{err || state?.error}</p>}
        <button className="btn-green w-full py-3" disabled={pending || busy}>{pending ? t("جارٍ التسليم...") : busy ? t("جارٍ تجهيز الصور...") : t("تسليم الإجابات")}</button>
      </div>
    </form>
  );
}
