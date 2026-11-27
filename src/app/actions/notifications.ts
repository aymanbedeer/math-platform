"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrent } from "@/lib/auth";
import { markRead } from "@/lib/notify";

export async function markAllRead() {
  const cur = await getCurrent();
  if (!cur) redirect("/login");
  await markRead(cur.user.id);
  revalidatePath("/", "layout");
}

/** Opens a notification: marks it read, then goes to what it is about. */
export async function openNotification(id: number) {
  const cur = await getCurrent();
  if (!cur) redirect("/login");
  const [n] = await db.select().from(schema.notifications)
    .where(and(eq(schema.notifications.id, id), eq(schema.notifications.userId, cur.user.id)));
  if (!n) return;
  await markRead(cur.user.id, [id]);
  revalidatePath("/", "layout");
  const home = cur.user.role === "teacher" ? "/t/notifications" : "/notifications";
  redirect(n.link && n.link.startsWith("/") ? n.link : home);
}
