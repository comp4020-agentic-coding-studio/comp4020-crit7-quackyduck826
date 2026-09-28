# COMP courses — First Semester 2027

ANU's course site (programsandcourses.anu.edu.au) only lets you check whether
a course is actually running next semester one course page at a time — and
some courses that show up in the course search as if they're offered turn out,
on their own page, to have no current offering at all. This app checks every
COMP-prefixed course's own Offerings page directly and lists all 128 of them
in one place, grouped by what it actually found: confirmed running First
Semester 2027, listed as running but no such offering exists (a mismatch, if
one ever turns up), sitting in the search results with zero current offerings
anywhere (the most common surprise — 27 of 128 right now), or genuinely
running a different semester.

A second, small feature sits alongside it: course notes. Anyone can flag
something about a course — a class number that's since changed, a correction,
a reminder for next year — and it's saved and shown to everyone, surviving a
reload the way the list of courses itself deliberately doesn't (that list gets
replaced wholesale by the latest scrape on every boot).

## What good looks like here

The headline promise is trustworthiness of the data, not completeness of the
UI: every status shown on `/` is derived directly from a real fetch of that
course's own ANU page (`scripts/scrape-courses.ts`), never guessed from the
catalogue search alone — that search field is shown alongside the derived
status specifically so a reader can see ANU's own claim next to the verified
truth and check the app's work. The rules that decision produced live in
`CLAUDE.md`.

What's enforced (see `spec/`): every scraped course code appears on the list,
each links out to its own ANU page so the claim is checkable, the status
filter shows exactly the matching group, and a submitted note survives a
fresh page load. What's a judgement call, not a test: whether the four status
groups and their ordering (the least-expected finding first) actually
communicate the mismatch clearly, and whether the course data is current —
the scrape is a point-in-time snapshot, re-run by hand
(`pnpm run scrape:courses`), not live.

What I chose not to build: accounts or authentication (notes are anonymous,
same as the starter's guestbook was), live cross-tab updates (a course list
doesn't change second-to-second the way a chat does), and coverage beyond
COMP-prefixed courses (scoped deliberately — the brief asks for a slice, not
the whole system).
