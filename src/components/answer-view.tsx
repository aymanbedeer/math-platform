import type { schema } from "@/db";
import { KIND_LABEL } from "@/lib/task-kinds";

type File = { id: number; name: string; size: number; mime: string };

/**
 * One question with a student's answer. `reveal` shows the correct answer.
 * `t` is passed in so this works from any server page.
 */
export default function AnswerView({ q, a, files, reveal, t, index, children }: {
  q: schema.TaskQuestion; a: schema.TaskAnswerRow | undefined; files: File[]; reveal: boolean; index: number;
  t: (s: string, v?: Record<string, string | number>) => string; children?: React.ReactNode;
}) {
  const v = a?.value ?? [];
  const correct = q.correct ?? [];
  const tf = (x: unknown) => (Number(x) === 1 ? t("صح") : t("خطأ"));
  const status = a?.points == null ? null : a.points >= q.points ? "ok" : a.points > 0 ? "part" : "bad";
  const ring = status === "ok" ? "border-emerald-300" : status === "part" ? "border-amber-300" : status === "bad" ? "border-red-300" : "border-slate-200";

  return (
    <section className={`card space-y-2 border-2 ${ring}`}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="badge bg-blue-100 text-blue-800">{t("سؤال {n}", { n: index })}</span>
        <span className="text-slate-500">{t(KIND_LABEL[q.kind])}</span>
        <span className="flex-1" />
        <span className="font-semibold">{a?.points == null ? t("بانتظار التصحيح") : `${a.points} / ${q.points}`}</span>
      </div>
      <p className="whitespace-pre-wrap font-semibold">{q.prompt}</p>

      {(q.kind === "single" || q.kind === "multi") && (
        <ul className="space-y-1 text-sm">
          {(q.options ?? []).map((o, i) => {
            const chosen = v.map(Number).includes(i), right = correct.map(Number).includes(i);
            return (
              <li key={i} className={`rounded-lg px-3 py-1.5 ${chosen ? (reveal ? (right ? "bg-emerald-50" : "bg-red-50") : "bg-blue-50") : reveal && right ? "bg-emerald-50/60" : ""}`}>
                {chosen ? "◉" : "○"} {o}
                {reveal && right && <span className="ms-2 text-xs text-emerald-700">✓ {t("الإجابة الصحيحة")}</span>}
              </li>
            );
          })}
        </ul>
      )}
      {q.kind === "truefalse" && (
        <p className="text-sm">{t("إجابة الطالب:")} <b>{v.length ? tf(v[0]) : t("لم يجب")}</b>
          {reveal && <span className="ms-3 text-emerald-700">{t("الصحيح:")} {tf(correct[0])}</span>}</p>
      )}
      {(q.kind === "short" || q.kind === "essay") && (
        <div className="space-y-1 text-sm">
          <div className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3">{v.length ? String(v[0]) : <span className="text-slate-400">{t("لم يجب")}</span>}</div>
          {reveal && q.kind === "short" && correct.length > 0 && <p className="text-emerald-700">{t("الإجابات المقبولة:")} {correct.join(" / ")}</p>}
        </div>
      )}
      {q.kind === "file" && (
        <ul className="space-y-1 text-sm">
          {files.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-2">
              <a href={`/api/answers/${f.id}`} target="_blank" className="text-blue-800 underline">{f.name}</a>
              <span className="muted text-xs">{Math.max(1, Math.round(f.size / 1024))} KB</span>
              <a href={`/api/answers/${f.id}?download=1`} className="text-xs text-slate-500 underline">{t("تنزيل")}</a>
            </li>
          ))}
          {!files.length && <li className="text-slate-400">{t("لم يرفع ملفات")}</li>}
          {files.filter((f) => f.mime.startsWith("image/") && !/hei[cf]/.test(f.mime)).map((f) => (
            // eslint-disable-next-line @next/next/no-img-element
            <li key={`img${f.id}`}><img src={`/api/answers/${f.id}`} alt={f.name} className="max-h-96 rounded-lg border border-slate-200" /></li>
          ))}
        </ul>
      )}
      {a?.comment && <p className="rounded-lg bg-blue-50 p-2 text-sm text-blue-900">💬 {a.comment}</p>}
      {children}
    </section>
  );
}
