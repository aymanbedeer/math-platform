"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { isLang, LANG_COOKIE } from "@/i18n/core";

export async function setLang(lang: string) {
  if (!isLang(lang)) return;
  (await cookies()).set(LANG_COOKIE, lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}
