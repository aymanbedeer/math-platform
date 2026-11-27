"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";

/**
 * YouTube (unlisted) embed with a moving name watermark on top.
 * Note: an unlisted YouTube link can still be copied and shared. For real
 * protection, switch this component to Bunny Stream later.
 */
export default function VideoPlayer({ videoId, watermark }: { videoId: string; watermark: string }) {
  const { t } = useI18n();
  const [pos, setPos] = useState({ top: 10, left: 10 });
  useEffect(() => {
    const t = setInterval(() => setPos({ top: 5 + Math.random() * 75, left: 5 + Math.random() * 60 }), 15000);
    return () => clearInterval(t);
  }, []);
  const src = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1`;
  return (
    <div className="protected relative aspect-video overflow-hidden rounded-2xl bg-black shadow" onContextMenu={(e) => e.preventDefault()}>
      <iframe
        src={src}
        className="absolute inset-0 h-full w-full"
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        title={t("فيديو الدرس")}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute z-10 rounded bg-black/30 px-2 py-0.5 text-xs font-semibold text-white/70 transition-all duration-1000 sm:text-sm"
        style={{ top: `${pos.top}%`, left: `${pos.left}%` }}
      >
        {watermark}
      </div>
    </div>
  );
}
