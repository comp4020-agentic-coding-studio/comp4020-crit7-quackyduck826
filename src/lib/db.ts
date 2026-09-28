import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import coursesSnapshot from "../../data/courses-2027-sem1.json";
import { type Course, type CourseNote, type Message, courseNotes, courses, messages } from "./schema";

// One SQLite file is the app's whole persistent state. In production
// fly.toml points DATABASE_PATH at the machine's volume (/data), which is
// how state survives a reload and a redeploy; locally it defaults to an
// untracked file in .data/.
const path = process.env.DATABASE_PATH ?? "./.data/app.db";
mkdirSync(dirname(path), { recursive: true });

const client = new Database(path);
client.pragma("journal_mode = WAL");

export const db = drizzle(client);

// Migrations run at boot, on whatever machine holds the volume — the
// recommended shape for SQLite on Fly, where there's no separate machine to
// run them from. The flow: edit src/lib/schema.ts, `pnpm db:generate`,
// commit the migration it writes to drizzle/.
migrate(db, { migrationsFolder: "./drizzle" });

// courses mirrors ANU's own site, not user data: data/courses-2027-sem1.json
// (written by `pnpm run scrape:courses`, bundled at build time the same way
// README.md is in src/pages/readme.astro) is the single source of truth, so
// every boot replaces the table wholesale from it. This runs in every
// environment — spec/global-setup.ts boots against a fresh throwaway DB per
// run, and the Fly machine reboots this same server after every idle
// auto-stop — with no network access, so the scrape itself can only ever run
// offline, ahead of time. course_notes is real user data and is never
// touched here.
db.transaction((tx) => {
  tx.delete(courses).run();
  for (const course of coursesSnapshot.courses) {
    tx.insert(courses)
      .values({ ...course, status: course.status as Course["status"], scrapedAt: coursesSnapshot.scrapedAt })
      .run();
  }
});

export type { Course, CourseNote, Message };

export function listMessages(): Message[] {
  return db.select().from(messages).orderBy(desc(messages.id)).limit(50).all();
}

export function addMessage(body: string): Message {
  return db.insert(messages).values({ body }).returning().get();
}

export const coursesScrapedAt: string = coursesSnapshot.scrapedAt;

export function listCourses(): Course[] {
  return db.select().from(courses).orderBy(courses.courseCode).all();
}

export function listNotes(): CourseNote[] {
  return db.select().from(courseNotes).orderBy(desc(courseNotes.id)).limit(100).all();
}

export function addNote(courseCode: string, body: string): CourseNote {
  return db.insert(courseNotes).values({ courseCode, body }).returning().get();
}
