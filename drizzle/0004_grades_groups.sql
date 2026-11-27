CREATE TABLE "grades" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "groups_name_unique" UNIQUE("name")
);
--> statement-breakpoint
INSERT INTO "grades" ("id", "name", "position") VALUES (1, 'الأول الثانوي', 1), (2, 'الثاني الثانوي', 2), (3, 'الثالث الثانوي', 3) ON CONFLICT DO NOTHING;--> statement-breakpoint
SELECT setval(pg_get_serial_sequence('grades', 'id'), (SELECT max("id") FROM "grades"));--> statement-breakpoint
INSERT INTO "groups" ("name") SELECT DISTINCT "group_name" FROM "users" WHERE "group_name" IS NOT NULL ON CONFLICT DO NOTHING;
