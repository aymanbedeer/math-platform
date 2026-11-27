// Interface language. Arabic text is the key; English comes from the dictionary.
import { EN } from "./en";

export type Lang = "ar" | "en";
export const LANG_COOKIE = "lang";

export function isLang(v: unknown): v is Lang {
  return v === "ar" || v === "en";
}

export type Vars = Record<string, string | number>;
export type T = (ar: string, vars?: Vars) => string;

const TZ = process.env.APP_TIMEZONE || "Africa/Cairo";

export function makeI18n(lang: Lang) {
  const locale = lang === "en" ? "en-GB" : "ar-EG";
  const t: T = (ar, vars) => {
    let s = lang === "en" ? (EN[ar] ?? ar) : ar;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
    return s;
  };
  const date = (d: string | Date | null | undefined) => {
    if (!d) return "—";
    const dt = typeof d === "string" ? new Date(d.length === 10 ? d + "T12:00:00Z" : d) : d;
    return new Intl.DateTimeFormat(locale, { timeZone: TZ, year: "numeric", month: "long", day: "numeric" }).format(dt);
  };
  const dateTime = (d: Date | null | undefined) =>
    d ? new Intl.DateTimeFormat(locale, { timeZone: TZ, dateStyle: "medium", timeStyle: "short" }).format(d) : "—";
  const money = (n: number) => new Intl.NumberFormat(locale).format(n);
  return { lang, dir: lang === "en" ? "ltr" : "rtl", t, date, dateTime, money } as const;
}

export type I18n = ReturnType<typeof makeI18n>;
