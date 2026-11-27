import type { SubStatus } from "@/lib/subscription";
import { statusColor, statusLabel } from "@/lib/subscription";
import { getI18n } from "@/i18n/server";

export async function StatusBadge({ status }: { status: SubStatus }) {
  const { t } = await getI18n();
  return <span className={`badge ${statusColor[status]}`}>{t(statusLabel[status])}</span>;
}

export function Notice({ kind = "info", children }: { kind?: "info" | "warn" | "error" | "ok"; children: React.ReactNode }) {
  const c = {
    info: "border-blue-200 bg-blue-50 text-blue-900",
    warn: "border-amber-200 bg-amber-50 text-amber-900",
    error: "border-rose-200 bg-rose-50 text-rose-900",
    ok: "border-emerald-200 bg-emerald-50 text-emerald-900",
  }[kind];
  return <div className={`rounded-xl border px-4 py-3 text-sm ${c}`}>{children}</div>;
}

export function Stat({ label, value, tone = "slate" }: { label: string; value: React.ReactNode; tone?: string }) {
  const c: Record<string, string> = {
    slate: "text-slate-900", green: "text-emerald-700", amber: "text-amber-700", rose: "text-rose-700", blue: "text-blue-800",
  };
  return (
    <div className="card">
      <div className="muted">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${c[tone]}`}>{value}</div>
    </div>
  );
}

export function whatsappLink(phone: string, text?: string) {
  let p = phone.replace(/[^\d]/g, "");
  if (p.startsWith("00")) p = p.slice(2);
  else if (p.startsWith("0")) p = "20" + p.slice(1); // assumes Egyptian local numbers; edit if needed
  return `https://wa.me/${p}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}


