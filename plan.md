# Crit 7: COMP course status aggregator (S1 2027)

## Context

Crit 7 ("Build the ANU system you wish existed") asks for a full-stack slice of
a real ANU system, wired end to end, with a flow that persists across a
reload. The student's own frustration: ANU's course site
(programsandcourses.anu.edu.au) only lets you check "is this course actually
running next semester" one course page at a time — and some courses appear on
the aggregate catalogue search as if offered, but their own page's "Offerings
and Dates" tab has no real class number for that session (or no offerings at
all). The app aggregates this across every COMP-prefixed course for Semester 1
2027 into one list, surfacing that mismatch directly. Repo:
`comp4020-crit7-quackyduck826` (Astro SSR + Drizzle + better-sqlite3 + Node
adapter, deployed to Fly.io). Deadline: 2026-09-30 07:00 Canberra.

Verified live against ANU's site (not assumed):
- `https://programsandcourses.anu.edu.au/data/CourseSearch/GetCourses?SearchText=COMP&MaxPageSize=500&PageSize=500&SelectedYear=2027`
  returns JSON `{TotalCount, Items:[{CourseCode, Name, Session, Career, Units, ModeOfDelivery, Year}]}`.
  Filtering `CourseCode` starting `"COMP"` gives ~128 courses. `Session` here is
  the catalogue's *claim* (can be blank — e.g. COMP1720 has `Session: ""`).
- Each course's own page, e.g. `https://programsandcourses.anu.edu.au/2027/course/comp2100`,
  has an "Offerings, Dates and Class Summary Links" section with year tabs
  (`.course-tabs-menu` links to `#course-tab-N`). Inside the 2027 tab, each
  session actually offered gets its own `<h3>First Semester</h3>` (or `Second
  Semester`) immediately followed by a `<table class="table-terms">` whose
  first `<tbody><tr><td>` is the real class number. A session not offered has
  no `<h3>` for it. A course with zero offerings shows plain text "There are no
  current offerings for this course." (verified on COMP1720). So "actually
  running S1 2027" = an `<h3>First Semester</h3>` under the 2027 tab with a
  real class number in the table that follows — independent of whatever the
  catalogue search claimed.

## Approach

### Data flow (the key decision)

`spec/global-setup.ts` boots the built server against a **fresh** throwaway
`DATABASE_PATH` for every spec run, and the Fly machine reboots the same
built server against the volume after every idle auto-stop. So whatever seeds
the `courses` table must run at **every boot**, with no network access and no
manual per-environment step — scraping ANU live from the running app is out.

Instead: a one-off local script scrapes ANU and writes a plain committed JSON
snapshot. That file is a normal static import (Vite/Astro already do exactly
this for `README.md` in `src/pages/readme.astro` — same mechanism, JSON
imports need no extra config). `src/lib/db.ts` imports it and, right after
`migrate()` on every boot, transactionally replaces the `courses` table
wholesale from the bundled snapshot (safe — it mirrors ANU's site, not user
data). `course_notes` (the persistent user-generated table) is never touched
by this step.

This means: CI's throwaway DB gets real data, the deployed volume gets the
current snapshot on every boot, and "refresh the data" = re-run the scraper
locally, commit the updated JSON, redeploy. No Dockerfile or `fly.toml`
changes needed.

### Schema (`src/lib/schema.ts`)

Two new tables, replacing `messages`:

```ts
export const courses = sqliteTable("courses", {
  courseCode: text("course_code").primaryKey(),        // "COMP1110"
  name: text().notNull(),
  catalogueSession: text("catalogue_session").notNull().default(""), // raw ANU "Session" field
  catalogueClaimsS1: int("catalogue_claims_s1", { mode: "boolean" }).notNull(),
  classNumber: text("class_number"),                    // real class number if confirmed, else null
  status: text({ enum: ["confirmed", "mismatch", "not_listed"] }).notNull(),
  scrapedAt: text("scraped_at").notNull(),
});

export const courseNotes = sqliteTable("course_notes", {
  id: int().primaryKey({ autoIncrement: true }),
  courseCode: text("course_code").notNull(),            // free text, no FK — courses gets wholesale-replaced
  body: text().notNull(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});
```

`status` is derived once at scrape time and stored (not computed on read):
`confirmed` = catalogue claims First Semester AND a class number was found;
`mismatch` = catalogue claims it but no class number was found (the headline
finding); `not_listed` = catalogue doesn't claim First Semester 2027 at all.
No FK, no indexes — not worth it at ~128 rows. Run `pnpm db:generate` after
editing, commit the migration.

### Scraper (`scripts/scrape-courses.ts`)

Add `cheerio` as a **devDependency** (only ever used by this offline script,
never imported from `src/`, so it never ships in the pruned production image).
Run with plain `node scripts/scrape-courses.ts` — `mise.toml` pins Node 24,
which strips TS type syntax natively, no `tsx`/`ts-node` needed.

1. Fetch the search endpoint once, filter to `COMP*` codes, compute
   `catalogueClaimsS1 = Session.includes("First Semester")`.
2. Sequentially (concurrency 1, ~250ms delay between requests — politeness,
   this is a real university's public site) fetch each course's own page.
3. Resolve the 2027 tab dynamically from `.course-tabs-menu` link text (don't
   hardcode `#course-tab-1` — guard against tab order varying across pages).
4. Within that tab: look for the "no current offerings" text, else an `<h3>`
   whose trimmed text is `"First Semester"`, else read the class number from
   the table that follows (prefer `.nextAll('table.table-terms').first()`
   over a strict immediate-sibling assumption — defensive against minor
   structural variance across ~128 real pages).
5. Wrap each per-course fetch in try/catch; log and skip failures rather than
   aborting the whole run.
6. Write `{ scrapedAt, courses: [...] }` to `data/courses-2027-sem1.json`,
   using the same field names as the Drizzle schema so `db.ts` can insert rows
   directly with no mapping glue.

Add `"scrape:courses": "node scripts/scrape-courses.ts"` to `package.json`.
Spot-check the three known cases after running: COMP1110/COMP2100 →
`confirmed`, COMP1720 → `mismatch` or `not_listed` (whichever its catalogue
`Session` field turns out to justify) before trusting the rest.

### Pages and routes

- **`src/pages/index.astro`** (course list, the headline feature): SSR reads
  courses from `src/lib/db.ts`, supports a `status`/`q` query-string filter via
  a plain `<form method="get">` (no JS, matches the existing pattern). Renders
  three sections with real `<h2>` headings (not colour alone — axe's
  color-contrast rule is disabled in the invariants suite, so don't rely on
  colour to carry the distinction): **mismatch** group first (that's the
  point of the tool), then confirmed, then not-listed. A one-line summary
  banner up top ("128 COMP courses checked, scraped {date} — N mismatches
  found"). Each row: code, name, ANU's raw session claim, class number if any,
  a link out to the course's own ANU page, a link to `/notes/?course={code}`.
- **`src/pages/notes.astro`** (`/notes/`, the persistent-flow feature):
  prefills `courseCode` from `?course=`, form posts to `/api/notes`, lists
  notes newest-first below. Structurally the guestbook's create+list+redirect
  pattern, scoped to a course code instead of a bare message.
- **`src/pages/api/notes.ts`**: mirrors `src/pages/api/messages.ts` — read
  form data, trim/cap lengths, insert, 303-redirect to `/notes/`. No SSE/event
  bus — there's no live cross-tab requirement here, so don't carry that
  pattern forward unused.
- **`src/layouts/Base.astro`** (new): extracts the `<html>`/`<head>`/`<nav>`
  shell currently duplicated between `index.astro` and `readme.astro`. Nav
  becomes Courses (`/`) / Notes (`/notes/`) / About (`/readme/`). All three
  pages use it.
- **`spec/routes.ts`**: `["/", "/notes/", "/readme/"]` — add `/notes/` in the
  same commit its page lands, or the invariants suite silently stops covering
  it.

### Delete

`src/pages/api/messages.ts`, `src/pages/api/events.ts`, `src/lib/events.ts`
(the whole SSE/EventEmitter pattern), `spec/guestbook.test.ts` (its own
comment says to delete it once the guestbook is replaced), the guestbook's
`<ul id="messages">` + inline SSE-subscribe `<script>`. Drop the `messages`
table from `schema.ts` (+ its `db.ts` helpers) as its **own** later commit
once nothing references it, so the schema history shows "add the new thing"
then "retire the old thing" as distinct steps.

### Spec lines this makes mechanically checkable

`spec/courses.test.ts`: `/` responds 200 and shows ≥100 COMP course codes;
every row carries exactly one of the three status labels; `/?status=mismatch`
returns only mismatch rows; each row links out to its ANU page. Phrase these
as contracts on counts/labels, not on *which* specific courses land where —
robust to a future re-scrape changing the data.

`spec/notes.test.ts` (adapt `guestbook.test.ts`'s persistence assertions,
minus the SSE section): `POST /api/notes` returns 303 to `/notes/`; a fresh
`GET /notes/` afterwards includes the submitted code and body — this is the
"core flow persists across a reload" contract; two notes render newest-first.

### Sequencing (visible, demoable commits)

1. `pnpm add -D cheerio`; scraper step 1 only (fetch+filter, log the COMP
   count) — smallest visible progress, no schema changes yet.
2. Extend the scraper through full page-parsing; write and manually verify
   `data/courses-2027-sem1.json` against the three known cases.
3. Add `courses`/`courseNotes` to `schema.ts` (`messages` stays for now),
   `pnpm db:generate`, commit the migration + first data snapshot. Wire the
   reseed-on-boot block + query helpers into `db.ts`.
4. Extract `Base.astro`; rewrite `index.astro` as the course list; update
   `readme.astro`. Delete the guestbook's markup, `api/messages.ts`,
   `api/events.ts`, `lib/events.ts`, `spec/guestbook.test.ts` in this commit.
5. Add `notes.astro` + `api/notes.ts`; add `/notes/` to `spec/routes.ts` and
   the nav.
6. Drop `messages` from `schema.ts`, `pnpm db:generate` for the drop
   migration — its own commit.
7. Write `spec/courses.test.ts` and `spec/notes.test.ts`.
8. Rewrite `README.md`, fill in `CLAUDE.md`, write `PROCESS.md` and
   `reflections/crit-7.md` alongside the build (real commit citations as you
   go, not reconstructed after).
9. `flyctl deploy --remote-only --ha=false -a comp4020-crit7-quackyduck826`;
   verify the live URL shows real course data and a submitted note survives an
   actual reload before the cutoff.
10. If time remains: collapse the "not listed at all" group behind a
    `<details>` to keep visual focus on the two interesting groups.

## Critical files

- `src/lib/schema.ts`, `src/lib/db.ts` — schema + boot-time reseed + query helpers
- `scripts/scrape-courses.ts` (new), `data/courses-2027-sem1.json` (new)
- `src/pages/index.astro`, `src/pages/notes.astro` (new), `src/pages/api/notes.ts` (new)
- `src/layouts/Base.astro` (new)
- `spec/routes.ts`, `spec/courses.test.ts` (new), `spec/notes.test.ts` (new)

## Verification

- `pnpm run scrape:courses` locally, spot-check the three known cases, then
  `pnpm check` (typecheck + `astro build` + vitest, including the new spec
  files) — must be green.
- `pnpm dev`, visit `/` and confirm the mismatch/confirmed/not-listed groups
  look right against a couple of courses checked by hand on ANU's own site;
  visit `/notes/`, submit a note, reload, confirm it's still there.
- After `flyctl deploy`, repeat the reload-persistence check against the live
  `*.fly.dev` URL, and run
  `APP_URL=https://comp4020-crit7-quackyduck826.fly.dev pnpm check` per the
  starter's own convention for the full-stack half.
