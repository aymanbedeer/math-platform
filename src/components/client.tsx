"use client";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { useI18n } from "@/i18n/client";

export function SubmitButton({ children, className = "btn-primary", confirm }: {
  children: React.ReactNode; className?: string; confirm?: string;
}) {
  const { t } = useI18n();
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      onClick={(e) => { if (confirm && !window.confirm(confirm)) e.preventDefault(); }}
    >
      {pending ? t("جارٍ...") : children}
    </button>
  );
}

export function CopyButton({ text, label }: { text: string; label?: string }) {
  const { t } = useI18n();
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn-light"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? t("تم النسخ ✓") : (label ?? t("نسخ"))}
    </button>
  );
}
