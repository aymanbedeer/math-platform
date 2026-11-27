// Creates the settings row and the teacher account. With --demo, also adds sample students and lessons.
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import { hashPassword, tempPassword } from "../src/lib/crypto";
import { addDays, today } from "../src/lib/dates";

const client = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(client, { schema });

await db.insert(schema.settings).values({ id: 1 }).onConflictDoNothing();

const username = (process.env.TEACHER_USERNAME || "teacher").toLowerCase();
const [existing] = await db.select().from(schema.users).where(eq(schema.users.username, username));
if (!existing) {
  const password = process.env.TEACHER_PASSWORD || tempPassword(10);
  await db.insert(schema.users).values({
    role: "teacher", username, fullName: "المعلم", passwordHash: await hashPassword(password), mustChangePassword: false,
  });
  console.log(`Teacher account created: ${username} / ${password}`);
} else {
  console.log(`Teacher account ${username} already exists`);
}

const wantDemo = process.argv.includes("--demo") || process.env.DEMO_DATA === "1";
const hasContent = (await db.select().from(schema.units).limit(1)).length > 0;
if (wantDemo && !hasContent) {
  const t = today();
  await db.update(schema.settings).set({
    teacherName: "أ. أحمد", platformName: "خوارزميات البسيوني في الرياضيات", whatsapp: "01012345678", monthlyFee: 200, graceDays: 3,
  }).where(eq(schema.settings.id, 1));
  const pw = await hashPassword("123456");
  const demo = [
    { username: "s1001", fullName: "محمد علي حسن", grade: 2, expiresAt: addDays(t, 20), parentPhone: "01011111111" },
    { username: "s1002", fullName: "سارة محمود", grade: 2, expiresAt: addDays(t, 4), parentPhone: "01022222222" },
    { username: "s1003", fullName: "يوسف إبراهيم", grade: 2, expiresAt: addDays(t, -2), parentPhone: "01033333333" },
    { username: "s1004", fullName: "مريم خالد", grade: 2, expiresAt: addDays(t, -10), parentPhone: "01044444444" },
    { username: "s1005", fullName: "عمر طارق", grade: 1, expiresAt: addDays(t, 15), parentPhone: "01055555555" },
  ];
  for (const d of demo) {
    const [u] = await db.insert(schema.users).values({ role: "student", passwordHash: pw, mustChangePassword: false, ...d })
      .onConflictDoNothing().returning();
    if (u) {
      await db.insert(schema.payments).values({
        studentId: u.id, amount: 200, months: 1, method: "cash", periodFrom: addDays(d.expiresAt, -30), periodTo: d.expiresAt,
      });
      await db.insert(schema.accountEvents).values({ studentId: u.id, kind: "payment", note: `دفع 200 عن شهر حتى ${d.expiresAt}` });
    }
  }
  const [g1, g2] = await db.insert(schema.groups).values([{ name: "1", gradeId: 2 }, { name: "2", gradeId: 2 }]).returning();
  for (const [u, g] of [["s1001", g1], ["s1002", g1], ["s1003", g2], ["s1004", g2]] as const) {
    await db.update(schema.users).set({ groupId: g.id }).where(eq(schema.users.username, u));
  }
  const [unit] = await db.insert(schema.units).values({ grade: 2, title: "التفاضل", position: 1 }).returning();
  const [unit2] = await db.insert(schema.units).values({ grade: 2, title: "التكامل", position: 2 }).returning();
  const now = new Date();
  const ls = await db.insert(schema.lessons).values([
    { unitId: unit.id, title: "مقدمة في النهايات", description: "درس تجريبي مجاني", status: "free", position: 1, publishedAt: now },
    { unitId: unit.id, title: "قواعد الاشتقاق", description: "مشتقة كثيرات الحدود وقاعدة الضرب والقسمة", status: "published", position: 2, publishedAt: now },
    { unitId: unit.id, title: "مشتقات الدوال المثلثية", status: "draft", position: 3 },
    { unitId: unit2.id, title: "التكامل غير المحدد", status: "published", position: 1, publishedAt: now },
  ]).returning();
  await db.insert(schema.lessonFiles).values([
    { lessonId: ls[1].id, kind: "video", title: "شرح قواعد الاشتقاق", url: "dQw4w9WgXcQ", position: 1 },
    { lessonId: ls[1].id, kind: "link", title: "اختبار قصير على الدرس", url: "https://forms.gle/example", position: 3 },
  ]);
  await db.insert(schema.announcements).values({ body: "حصة مراجعة يوم الخميس الساعة 7 مساءً على الدرس الثاني.", grade: 2 });
  console.log("Demo data added (student password: 123456)");
}
await client.end();
