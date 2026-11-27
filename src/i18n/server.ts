import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { isLang, LANG_COOKIE, makeI18n, type Lang } from "./core";

export const getLang = cache(async (): Promise<Lang> => {
  const v = (await cookies()).get(LANG_COOKIE)?.value;
  return isLang(v) ? v : "ar";
});

/** Translator, date/number formatters and text direction for the current request. */
export const getI18n = cache(async () => makeI18n(await getLang()));
