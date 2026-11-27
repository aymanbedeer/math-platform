import { requireTeacher } from "@/lib/auth";
import { NotificationList } from "@/components/notifications";

export default async function TeacherNotifications() {
  const me = await requireTeacher();
  return <NotificationList userId={me.id} />;
}
