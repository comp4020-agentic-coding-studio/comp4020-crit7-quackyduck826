# Your harness

Rules for working on this repo:

- `data/courses-2027-sem1.json` is the only source `src/lib/db.ts` reads to
  populate the `courses` table, and it's only ever written by
  `scripts/scrape-courses.ts`. Never hand-edit it or seed `courses` any other
  way — the whole point is that every row traces back to a real fetch of the
  course's own ANU page, not a guess.
- Never scrape ANU's site from a request path (a page, an API route). The
  scraper runs offline, on demand, writing the committed JSON snapshot; the
  app itself only ever reads that file.
- `liked_courses` is real user data. Never wipe or migrate it destructively —
  unlike `courses`, it isn't derived from anything and can't be regenerated.
- Spec tests (`spec/*.test.ts`) assert what the served HTML/response
  contains, not implementation details, and check against the scraped
  snapshot's own data rather than hardcoding specific course codes, so a
  future re-scrape doesn't break them.
- Schema changes go through `src/lib/schema.ts` → `pnpm db:generate` → commit
  both the code and the migration it writes under `drizzle/`, in that order,
  in the same commit.
