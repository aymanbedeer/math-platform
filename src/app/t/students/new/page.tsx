import { headers } from "next/headers";
import { getSettings } from "@/lib/auth";
import NewStudentForm from "./form";
import { getGrades, getGroups } from "@/lib/grades";
import { getI18n } from "@/i18n/server";

export default async function NewStudent() {
  const { t } = await getI18n();
  const s = await getSettings();
  const h = await headers();
  const loginUrl = `${h.get("x-forwarded-proto") || "https"}://${h.get("host")}/login`;
  return (
    <>
      <h1 className="h1">{t("إضافة طالب")}</h1>
      <NewStudentForm fee={s.monthlyFee} loginUrl={loginUrl} groups={await getGroups()} grades={(await getGrades()).map((g) => ({ id: g.id, name: t(g.name) }))} />
    </>
  );
}
