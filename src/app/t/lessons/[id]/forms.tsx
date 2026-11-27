"use client";
import { useActionState, useRef, useState } from "react";
import { addLink, addVideo, uploadPdf, type MsgState } from "@/app/actions/teacher";
import { SubmitButton } from "@/components/client";
import { useI18n } from "@/i18n/client";

function Msg({ s }: { s: MsgState }) {
  if (s?.error) return <p className="text-sm text-rose-700">{s.error}</p>;
  if (s?.ok) return <p className="text-sm text-emerald-700">{s.ok}</p>;
  return null;
}

export function AddVideo({ lessonId, position }: { lessonId: number; position: number }) {
  const { t } = useI18n();
  const [s, action] = useActionState(addVideo.bind(null, lessonId), undefined);
  return (
    <form action={action} className="card space-y-2">
      <h3 className="font-bold">{t("إضافة فيديو")}</h3>
      <p className="muted">{t("ارفع الفيديو على YouTube كـ «غير مُدرج» (Unlisted)، ثم الصق الرابط هنا.")}</p>
      <input name="url" className="input" dir="ltr" placeholder="https://youtu.be/..." required />
      <input name="title" className="input" placeholder={t("العنوان (اختياري)")} />
      <input type="hidden" name="position" value={position} />
      <Msg s={s} />
      <SubmitButton>{t("إضافة الفيديو")}</SubmitButton>
    </form>
  );
}

export function AddLink({ lessonId, position }: { lessonId: number; position: number }) {
  const { t } = useI18n();
  const [s, action] = useActionState(addLink.bind(null, lessonId), undefined);
  return (
    <form action={action} className="card space-y-2">
      <h3 className="font-bold">{t("رابط خارجي")}</h3>
      <p className="muted">{t("مثل اختبار Google Forms.")}</p>
      <input name="url" className="input" dir="ltr" placeholder="https://forms.gle/..." required />
      <input name="title" className="input" placeholder={t("العنوان، مثل: اختبار الدرس")} />
      <input type="hidden" name="position" value={position} />
      <Msg s={s} />
      <SubmitButton>{t("إضافة الرابط")}</SubmitButton>
    </form>
  );
}

export function PdfDrop({ lessonId, position }: { lessonId: number; position: number }) {
  const { t } = useI18n();
  const [s, action] = useActionState(uploadPdf.bind(null, lessonId), undefined);
  const input = useRef<HTMLInputElement>(null);
  const [names, setNames] = useState<string[]>([]);
  const [over, setOver] = useState(false);

  return (
    <form action={action} className="card space-y-2">
      <h3 className="font-bold">{t("رفع PDF")}</h3>
      <p className="muted">{t("ملفات PowerPoint: احفظها كـ PDF أولًا (ملف ← حفظ باسم ← PDF).")}</p>
      <label
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (input.current && e.dataTransfer.files.length) {
            input.current.files = e.dataTransfer.files;
            setNames(Array.from(e.dataTransfer.files, (f) => f.name));
          }
        }}
        className={`flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-3 text-center text-sm ${over ? "border-blue-700 bg-blue-50" : "border-slate-300"}`}
      >
        <span className="font-semibold">{t("اسحب الملفات هنا")}</span>
        <span className="text-slate-500">{t("أو اضغط للاختيار")}</span>
        {names.length > 0 && <span className="mt-2 text-blue-800">{names.join(t("، "))}</span>}
        <input ref={input} type="file" name="files" accept="application/pdf,.pdf,.ppt,.pptx" multiple className="hidden"
          onChange={(e) => setNames(Array.from(e.target.files ?? [], (f) => f.name))} />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="allowDownload" /> {t("السماح بتحميله (لأوراق التمارين)")}
      </label>
      <input type="hidden" name="position" value={position} />
      <Msg s={s} />
      <SubmitButton>{t("رفع")}</SubmitButton>
    </form>
  );
}
