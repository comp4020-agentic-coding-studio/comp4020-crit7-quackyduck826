# COMP courses — 2027

ANU's course site (programsandcourses.anu.edu.au) only lets you check whether
a course is actually running one course page at a time — and some courses
that show up in the course search as if they're offered turn out, on their
own page, to have no current offering at all. This app checks every
COMP-prefixed course's own Offerings page directly for 2027 and lists all 128
of them in one flat, filterable table: real class number for First Semester,
real class number for Second Semester, and whether the course has any current
offering at all (27 of 128 don't, despite sitting in the search results as if
active). Filters combine — search, which semester it's actually confirmed
running, and course level (1000/2000/3000/4000/6000/8000) — rather than
pre-sorting courses into fixed groups, so a reader can slice the list however
they're actually using it.

A second, small feature sits alongside it: courses are likeable. Tick the
heart on any row to mark it, and the list can be sorted to show liked courses
first — a shortlist that's saved and shared with everyone, surviving a reload
the way the list of courses itself deliberately doesn't (that list gets
replaced wholesale by the latest scrape on every boot).

## What good looks like here

The headline promise is trustworthiness of the data, not completeness of the
UI: every class number shown on `/` is read directly from a real fetch of
that course's own ANU page (`scripts/scrape-courses.ts`), never guessed from
the catalogue search alone — that search field is shown alongside the scraped
truth specifically so a reader can see ANU's own claim next to what was
actually found and check the app's work. The rules that decision produced
live in `CLAUDE.md`.

What's enforced (see `spec/`): every scraped course code appears on the list,
each links out to its own ANU page so the claim is checkable, and the
offering/level filters each show exactly the matching courses. What's a
judgement call, not a test: whether a flat, filterable table communicates the
"no current offerings" surprise as clearly as separated groups would, and
whether the course data is current — the scrape is a point-in-time snapshot,
re-run by hand (`pnpm run scrape:courses`), not live.

What I chose not to build: accounts or authentication (likes are shared and
anonymous, same as the starter's guestbook was), live cross-tab updates (a
course list doesn't change second-to-second the way a chat does), and
coverage beyond COMP-prefixed courses (scoped deliberately — the brief asks
for a slice, not the whole system).
