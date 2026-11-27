import { saveTask } from "@/app/actions/tasks";
import { getGrades, getGroups } from "@/lib/grades";
import { getI18n } from "@/i18n/server";
import TaskEditor from "../editor";

export default async function NewTask() {
  const { t } = await getI18n();
  const grades = (await getGrades()).map((g) => ({ id: g.id, name: t(g.name) }));
  return (
    <>
      <h1 className="h1">{t("مهمة جديدة")}</h1>
      <TaskEditor initial={null} grades={grades} groups={await getGroups()} locked={false} action={saveTask.bind(null, null)} />
    </>
  );
}
