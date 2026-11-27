import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { subscriptionStatus, type SubStatus } from "./subscription";

export type StudentRow = schema.User & { status: SubStatus; lastPayment: string | null };

/** All students with computed status and the date of their last payment. */
export async function listStudents(graceDays: number): Promise<StudentRow[]> {
  const lastPay = db.select({
    studentId: schema.payments.studentId,
    last: sql<Date>`max(${schema.payments.createdAt})`.as("last"),
  }).from(schema.payments).groupBy(schema.payments.studentId).as("lp");
  const rows = await db.select({ u: schema.users, last: lastPay.last }).from(schema.users)
    .leftJoin(lastPay, eq(lastPay.studentId, schema.users.id))
    .where(eq(schema.users.role, "student"))
    .orderBy(schema.users.grade, schema.users.fullName);
  return rows.map(({ u, last }) => ({
    ...u,
    status: subscriptionStatus(u, graceDays),
    lastPayment: last ? new Date(last).toISOString() : null,
  }));
}

export async function studentPayments(id: number) {
  return db.select().from(schema.payments).where(eq(schema.payments.studentId, id)).orderBy(desc(schema.payments.createdAt));
}

