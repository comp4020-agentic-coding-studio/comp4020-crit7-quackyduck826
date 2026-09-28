import { sql } from "drizzle-orm";
import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";

// The schema is the ground truth for the database. To change it: edit here,
// run `pnpm db:generate` to turn the diff into a migration under drizzle/,
// and commit both — the migration applies automatically when the server
// boots (see src/lib/db.ts), locally and deployed. Never edit the database
// by hand: state on the deployed volume outlives every deploy, and the
// migration trail is what keeps old state and new code compatible.
// Courses mirrors ANU's own site, not user data: it's wholesale-replaced from
// data/courses-2027-sem1.json on every boot (see src/lib/db.ts), never
// written to directly, so it needs no migration-safe evolution story of its
// own. courseCode is the natural key — every lookup is by code.
export const courses = sqliteTable("courses", {
  courseCode: text("course_code").primaryKey(),
  name: text().notNull(),
  // ANU's own "Session" field from the catalogue search — what it *claims*,
  // kept alongside the scraped truth below so a reader can compare them.
  catalogueSession: text("catalogue_session").notNull().default(""),
  // The real class number read from each semester's own Offerings page, or
  // null if that session has no such offering there. This is the
  // authoritative signal — catalogueSession above is not trusted on its own.
  firstSemClassNumber: text("first_sem_class_number"),
  secondSemClassNumber: text("second_sem_class_number"),
  // Whether the course's own page has ANY current offering at all (any
  // session, any year) — false despite sitting in ANU's course search as if
  // live is the most common surprise this app surfaces.
  hasAnyOffering: int("has_any_offering", { mode: "boolean" }).notNull().default(false),
  scrapedAt: text("scraped_at").notNull(),
});
export type Course = typeof courses.$inferSelect;

// Unlike courses, this is real user data — created by students browsing the
// list, and expected to survive every reload, restart and redeploy. No FK to
// courses.courseCode: courses gets wholesale-replaced on every boot, which
// would fight a foreign key against notes that are meant to last.
export const courseNotes = sqliteTable("course_notes", {
  id: int().primaryKey({ autoIncrement: true }),
  courseCode: text("course_code").notNull(),
  body: text().notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});
export type CourseNote = typeof courseNotes.$inferSelect;
