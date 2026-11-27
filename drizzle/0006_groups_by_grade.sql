ALTER TABLE "groups" DROP CONSTRAINT "groups_name_unique";--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "grade_id" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "group_id" integer;--> statement-breakpoint
-- Each existing group goes to the grade most of its students are in (or the first grade if it has none).
UPDATE "groups" g SET "grade_id" = COALESCE(
  (SELECT u."grade" FROM "users" u WHERE u."group_name" = g."name" AND u."grade" IS NOT NULL GROUP BY u."grade" ORDER BY count(*) DESC, u."grade" LIMIT 1),
  (SELECT min("id") FROM "grades"));--> statement-breakpoint
-- A group name used in several grades becomes one group per grade.
INSERT INTO "groups" ("name", "grade_id")
  SELECT DISTINCT u."group_name", u."grade" FROM "users" u
  WHERE u."group_name" IS NOT NULL AND u."grade" IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM "groups" g WHERE g."name" = u."group_name" AND g."grade_id" = u."grade");--> statement-breakpoint
UPDATE "users" u SET "group_id" = g."id" FROM "groups" g WHERE g."name" = u."group_name" AND g."grade_id" = u."grade";--> statement-breakpoint
DELETE FROM "groups" WHERE "grade_id" IS NULL;--> statement-breakpoint
ALTER TABLE "groups" ALTER COLUMN "grade_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_grade_id_grades_id_fk" FOREIGN KEY ("grade_id") REFERENCES "public"."grades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "groups_grade_name" ON "groups" USING btree ("grade_id","name");
