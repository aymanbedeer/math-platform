import {
  pgTable, serial, text, integer, boolean, timestamp, date, primaryKey, index, uniqueIndex, jsonb,
} from "drizzle-orm/pg-core";

export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  teacherName: text("teacher_name").notNull().default("الأستاذ"),
  platformName: text("platform_name").notNull().default("خوارزميات البسيوني في الرياضيات"),
  whatsapp: text("whatsapp").notNull().default(""),
  graceDays: integer("grace_days").notNull().default(3),
  reminderDays: integer("reminder_days").notNull().default(5),
  monthlyFee: integer("monthly_fee").notNull().default(0),
  maxDevices: integer("max_devices").notNull().default(1),
});

/** School grades the teacher teaches (1-3 are created by the first migration; the teacher can add more). */
export const grades = pgTable("grades", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  position: integer("position").notNull().default(0),
});

/** Student groups (classes/sessions). Each belongs to one grade; names are unique within a grade. */
export const groups = pgTable("groups", {
  id: serial("id").primaryKey(),
  gradeId: integer("grade_id").notNull().references(() => grades.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  position: integer("position").notNull().default(0),
}, (t) => [uniqueIndex("groups_grade_name").on(t.gradeId, t.name)]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  role: text("role", { enum: ["teacher", "student"] }).notNull(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  grade: integer("grade"), // 1..3 for students
  parentPhone: text("parent_phone"),
  email: text("email"), // optional personal email, set by the user on their profile
  phone: text("phone"), // optional own phone number, set by the user on their profile
  groupId: integer("group_id").references(() => groups.id, { onDelete: "set null" }), // must be a group of the student's grade
  expiresAt: date("expires_at", { mode: "string" }),
  exempt: boolean("exempt").notNull().default(false),
  suspended: boolean("suspended").notNull().default(false),
  suspendReason: text("suspend_reason"),
  mustChangePassword: boolean("must_change_password").notNull().default(true),
  failedLogins: integer("failed_logins").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Devices a student is bound to. A device is identified by a long-lived random cookie;
 * only its sha256 is stored. Signing in from an unregistered device is refused once the
 * student has settings.maxDevices registered devices; the teacher removes one to allow a new device.
 */
export const devices = pgTable("devices", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  keyHash: text("key_hash").notNull(),
  name: text("name").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("devices_user_key").on(t.userId, t.keyHash)]);

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(), // sha256 of the cookie token
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  device: text("device").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
}, (t) => [index("sessions_user_idx").on(t.userId)]);

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  method: text("method", { enum: ["cash", "transfer"] }).notNull(),
  months: integer("months").notNull(),
  periodFrom: date("period_from", { mode: "string" }).notNull(),
  periodTo: date("period_to", { mode: "string" }).notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("payments_student_idx").on(t.studentId)]);

// Audit log: every payment, suspension, activation, exemption, manual extension
export const accountEvents = pgTable("account_events", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("events_student_idx").on(t.studentId)]);

export const units = pgTable("units", {
  id: serial("id").primaryKey(),
  grade: integer("grade").notNull(),
  title: text("title").notNull(),
  position: integer("position").notNull().default(0),
  visibleFrom: date("visible_from", { mode: "string" }),
});

export const lessons = pgTable("lessons", {
  id: serial("id").primaryKey(),
  unitId: integer("unit_id").notNull().references(() => units.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  status: text("status", { enum: ["draft", "published", "free"] }).notNull().default("draft"),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
});

export const lessonFiles = pgTable("lesson_files", {
  id: serial("id").primaryKey(),
  lessonId: integer("lesson_id").notNull().references(() => lessons.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["video", "pdf", "link"] }).notNull(),
  title: text("title").notNull(),
  url: text("url"), // youtube id for video, url for link
  storageKey: text("storage_key"), // for pdf
  allowDownload: boolean("allow_download").notNull().default(false),
  position: integer("position").notNull().default(0),
});

export const completions = pgTable("completions", {
  studentId: integer("student_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  lessonId: integer("lesson_id").notNull().references(() => lessons.id, { onDelete: "cascade" }),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.studentId, t.lessonId] })]);

export const lessonViews = pgTable("lesson_views", {
  studentId: integer("student_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  lessonId: integer("lesson_id").notNull().references(() => lessons.id, { onDelete: "cascade" }),
  firstViewedAt: timestamp("first_viewed_at", { withTimezone: true }).notNull().defaultNow(),
  lastViewedAt: timestamp("last_viewed_at", { withTimezone: true }).notNull().defaultNow(),
  count: integer("count").notNull().default(1),
}, (t) => [primaryKey({ columns: [t.studentId, t.lessonId] })]);

export const announcements = pgTable("announcements", {
  id: serial("id").primaryKey(),
  grade: integer("grade"), // null = all grades
  body: text("body").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const passwordRequests = pgTable("password_requests", {
  id: serial("id").primaryKey(),
  username: text("username").notNull(),
  handled: boolean("handled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * In-app notifications (the bell). Text is rendered from `kind` + `params` in the reader's
 * language, so the same row reads correctly in Arabic and English.
 */
export const notificationKinds = ["task", "lesson", "file", "announcement", "graded", "submitted"] as const;
export type NotificationKind = (typeof notificationKinds)[number];
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: notificationKinds }).notNull(),
  params: jsonb("params").$type<Record<string, string | number>>().notNull().default({}),
  link: text("link"),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("notifications_user_created").on(t.userId, t.createdAt)]);

export type User = typeof users.$inferSelect;
export type Settings = typeof settings.$inferSelect;


/**
 * A task (assignment) the teacher sets for a grade, or one group of it, with a due date.
 * Questions can be any mix of the kinds in QuestionKind; homework uploads are "file" questions.
 */
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  gradeId: integer("grade_id").notNull().references(() => grades.id, { onDelete: "cascade" }),
  groupId: integer("group_id").references(() => groups.id, { onDelete: "set null" }), // null = whole grade
  title: text("title").notNull(),
  instructions: text("instructions"),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
  allowLate: boolean("allow_late").notNull().default(false),
  published: boolean("published").notNull().default(false),
  showAnswers: boolean("show_answers").notNull().default(true), // show correct answers after the due date
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("tasks_grade").on(t.gradeId)]);

export const questionKinds = ["single", "multi", "truefalse", "short", "essay", "file"] as const;
export type QuestionKind = (typeof questionKinds)[number];

export const taskQuestions = pgTable("task_questions", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0),
  kind: text("kind", { enum: questionKinds }).notNull(),
  prompt: text("prompt").notNull(),
  options: jsonb("options").$type<string[]>(), // single / multi choices
  // single, multi: indexes of correct options; truefalse: [1] true / [0] false; short: accepted answers
  correct: jsonb("correct").$type<(number | string)[]>(),
  points: integer("points").notNull().default(1),
});

export const taskSubmissions = pgTable("task_submissions", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  studentId: integer("student_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  late: boolean("late").notNull().default(false),
  graded: boolean("graded").notNull().default(false), // true once every question has points
  score: integer("score").notNull().default(0),
  feedback: text("feedback"),
  gradedAt: timestamp("graded_at", { withTimezone: true }),
}, (t) => [uniqueIndex("task_submissions_one").on(t.taskId, t.studentId)]);

export const taskAnswers = pgTable("task_answers", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id").notNull().references(() => taskSubmissions.id, { onDelete: "cascade" }),
  questionId: integer("question_id").notNull().references(() => taskQuestions.id, { onDelete: "cascade" }),
  value: jsonb("value").$type<(number | string)[]>(), // chosen option indexes, [1]/[0] for true/false, or [text]
  points: integer("points"), // null = waiting for the teacher
  comment: text("comment"),
});

export const answerFiles = pgTable("answer_files", {
  id: serial("id").primaryKey(),
  answerId: integer("answer_id").notNull().references(() => taskAnswers.id, { onDelete: "cascade" }),
  storageKey: text("storage_key").notNull(),
  name: text("name").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
});

export type Task = typeof tasks.$inferSelect;
export type TaskQuestion = typeof taskQuestions.$inferSelect;
export type TaskSubmissionRow = typeof taskSubmissions.$inferSelect;
export type TaskAnswerRow = typeof taskAnswers.$inferSelect;
