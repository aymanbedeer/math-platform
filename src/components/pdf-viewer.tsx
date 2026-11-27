"use client";
import { useEffect, useRef, useState } from "react";
import { Watermark } from "./watermark";
import { useI18n } from "@/i18n/client";

/**
 * Renders a PDF page by page onto canvases (no browser PDF toolbar, so no
 * built-in download/print button), with the student's name over every page.
 */
export default function PdfViewer({ src, watermark, allowDownload }: { src: string; watermark: string; allowDownload: boolean }) {
  const { t } = useI18n();
  const box = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState(0);
  const [error, setError] = useState("");

  const docRef = useRef<import("pdfjs-dist").PDFDocumentProxy | null>(null);

  // 1) download and parse
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        const res = await fetch(src, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const doc = await pdfjs.getDocument({ data: await res.arrayBuffer() }).promise;
        if (cancelled) return;
        docRef.current = doc;
        setPages(doc.numPages);
      } catch {
        if (!cancelled) setError(t("تعذّر فتح الملف. حدّث الصفحة وحاول مرة أخرى."));
      }
    })();
    return () => { cancelled = true; };
  }, [src, t]);

  // 2) draw once the canvases exist
  useEffect(() => {
    const doc = docRef.current;
    if (!doc || !pages) return;
    let cancelled = false;
    (async () => {
      const width = box.current?.clientWidth || 800;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      for (let i = 1; i <= pages && !cancelled; i++) {
        const page = await doc.getPage(i);
        const base = page.getViewport({ scale: 1 });
        const vp = page.getViewport({ scale: (width / base.width) * dpr });
        const canvas = box.current?.querySelector<HTMLCanvasElement>(`canvas[data-p="${i}"]`);
        if (!canvas) return;
        canvas.width = vp.width;
        canvas.height = vp.height;
        await page.render({ canvasContext: canvas.getContext("2d")!, viewport: vp }).promise;
      }
    })();
    return () => { cancelled = true; };
  }, [pages]);

  return (
    <div className="space-y-2">
      <div ref={box} className="protected space-y-3" onContextMenu={(e) => e.preventDefault()}>
        {error && <p className="card text-sm text-rose-700">{error}</p>}
        {!pages && !error && <div className="card animate-pulse text-center text-sm text-slate-500">{t("جارٍ تحميل الملف...")}</div>}
        {Array.from({ length: pages }, (_, i) => (
          <div key={i} className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <canvas data-p={i + 1} className="block h-auto w-full" />
            <Watermark text={watermark} />
          </div>
        ))}
      </div>
      {allowDownload && <a href={`${src}&download=1`} className="btn-light">{t("تحميل الملف")}</a>}
    </div>
  );
}
