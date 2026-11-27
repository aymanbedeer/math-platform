import { requireStudent } from "@/lib/auth";
import { NotificationList } from "@/components/notifications";

export default async function StudentNotifications() {
  const { user } = await requireStudent();
  return <NotificationList userId={user.id} />;
}
