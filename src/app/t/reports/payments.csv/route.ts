import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrent } from "@/lib/auth";
import { gradeMap } from "@/lib/grades";
import { getI18n } from "@/i18n/server";

function cell(v: unknown) {
  let s = String(v ?? "");
  if (/^[=+\-@]/.test(s)) s = "'" + s; // avoid spreadsheet formula injection
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET() {
  const { t } = await getI18n();
  const gradeLabel = await gradeMap();
  const cur = await getCurrent();
  if (!cur || cur.user.role !== "teacher") return new Response("Forbidden", { status: 403 });
  const rows = await db.select({ p: schema.payments, u: schema.users }).from(schema.payments)
    .innerJoin(schema.users, eq(schema.users.id, schema.payments.studentId)).orderBy(desc(schema.payments.createdAt));
  const head = [t("التاريخ"), t("الطالب"), t("اسم المستخدم"), t("الصف"), t("المبلغ"), t("الطريقة"), t("عدد الأشهر"), t("من"), t("إلى"), t("ملاحظة")];
  const lines = rows.map(({ p, u }) => [
    p.createdAt.toISOString().slice(0, 10), u.fullName, u.username, t(gradeLabel[u.grade ?? 0] ?? "—"), p.amount,
    p.method === "cash" ? t("نقدًا") : t("تحويل"), p.months, p.periodFrom, p.periodTo, p.note,
  ].map(cell).join(","));
  // BOM so Excel opens Arabic text correctly
  const body = "﻿" + [head.map(cell).join(","), ...lines].join("\r\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="payments-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
