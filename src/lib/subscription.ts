import { addDays, addMonths, daysBetween, today } from "./dates";

export type SubStatus = "active" | "grace" | "locked";

type Sub = { expiresAt: string | null; exempt: boolean; suspended: boolean };

export function subscriptionStatus(u: Sub, graceDays: number, on: string = today()): SubStatus {
  if (u.suspended) return "locked";
  if (u.exempt) return "active";
  if (!u.expiresAt) return "locked";
  if (on <= u.expiresAt) return "active";
  if (on <= addDays(u.expiresAt, graceDays)) return "grace";
  return "locked";
}

/**
 * Where a new payment's period starts.
 * Still active or in grace: continue from the current expiry (no gap, grace days are paid for).
 * Already locked or never paid: start from today.
 */
export function paymentPeriod(u: Sub, months: number, graceDays: number, on: string = today()) {
  const st = subscriptionStatus({ ...u, suspended: false, exempt: false }, graceDays, on);
  const from = st !== "locked" && u.expiresAt ? addDays(u.expiresAt, 1) : on;
  const to = addDays(addMonths(from, months), -1);
  return { from, to };
}

export function daysLeft(expiresAt: string | null, on: string = today()) {
  return expiresAt ? daysBetween(on, expiresAt) : null;
}

export const statusLabel: Record<SubStatus, string> = {
  active: "مفعّل",
  grace: "فترة سماح",
  locked: "موقوف",
};

export const statusColor: Record<SubStatus, string> = {
  active: "bg-emerald-100 text-emerald-800",
  grace: "bg-amber-100 text-amber-800",
  locked: "bg-rose-100 text-rose-800",
};

export const gradeLabel: Record<number, string> = {
  1: "الأول الثانوي",
  2: "الثاني الثانوي",
  3: "الثالث الثانوي",
};

export const lessonStatus: Record<string, [string, string]> = {
  draft: ["مسوّدة", "bg-slate-200 text-slate-700"],
  published: ["منشور", "bg-emerald-100 text-emerald-800"],
  free: ["مجاني", "bg-violet-100 text-violet-800"],
};
