// All subscription dates are calendar dates (YYYY-MM-DD) in the teacher's time zone.
const TZ = process.env.APP_TIMEZONE || "Africa/Cairo";

export function today(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function parse(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return { y, m, day };
}
function fmt(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function addDays(d: string, n: number): string {
  const { y, m, day } = parse(d);
  const dt = new Date(Date.UTC(y, m - 1, day + n));
  return fmt(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

// Adds calendar months, clamping to the last day of the month (Jan 31 + 1 = Feb 28/29)
export function addMonths(d: string, n: number): string {
  const { y, m, day } = parse(d);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12), nm = (total % 12) + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return fmt(ny, nm, Math.min(day, last));
}

export function daysBetween(from: string, to: string): number {
  const a = parse(from), b = parse(to);
  return Math.round((Date.UTC(b.y, b.m - 1, b.day) - Date.UTC(a.y, a.m - 1, a.day)) / 86400000);
}

export function arDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d.length === 10 ? d + "T12:00:00Z" : d) : d;
  return new Intl.DateTimeFormat("ar-EG", { timeZone: TZ, year: "numeric", month: "long", day: "numeric" }).format(dt);
}

export function arDateTime(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("ar-EG", { timeZone: TZ, dateStyle: "medium", timeStyle: "short" }).format(d);
}

export function monthStart(d: string): string {
  return d.slice(0, 8) + "01";
}
