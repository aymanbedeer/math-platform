import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { saveTask } from "@/app/actions/tasks";
import { getGrades, getGroups } from "@/lib/grades";
import { questionsOf } from "@/lib/tasks";
import { getI18n } from "@/i18n/server";
import TaskEditor from "../../editor";

export default async function EditTask({ params }: { params: Promise<{ id: string }> }) {
  const { t } = await getI18n();
  const id = Number((await params).id);
  const [task] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, id));
  if (!task) notFound();
  const qs = await questionsOf(id);
  const [sub] = await db.select({ id: schema.taskSubmissions.id }).from(schema.taskSubmissions).where(eq(schema.taskSubmissions.taskId, id)).limit(1);
  const grades = (await getGrades()).map((g) => ({ id: g.id, name: t(g.name) }));
  return (
    <>
      <h1 className="h1">{t("تعديل المهمة")}</h1>
      <TaskEditor
        initial={{
          title: task.title, instructions: task.instructions ?? "", gradeId: task.gradeId, groupId: task.groupId,
          dueAt: task.dueAt.toISOString(), allowLate: task.allowLate, showAnswers: task.showAnswers, published: task.published,
          questions: qs.map((q) => ({ kind: q.kind, prompt: q.prompt, options: q.options ?? [], correct: q.correct ?? [], points: q.points })),
        }}
        grades={grades} groups={await getGroups()} locked={!!sub} action={saveTask.bind(null, id)} />
    </>
  );
}
