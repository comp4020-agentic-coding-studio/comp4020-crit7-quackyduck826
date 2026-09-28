# Process overview

## What I built

A tool that checks every COMP-prefixed course's own ANU page for whether it
actually has a real offering for First Semester 2027, instead of trusting the
catalogue search's claim — plus a small persistent notes feature layered on
top. `README.md` has the full account of what it is and what good means here.

## How I got here

The idea came from my own frustration with ANU's course site: you can only
check whether a course is really running by opening its own page, and I'd
noticed some courses sitting in the search results as if active with no real
offering behind them. Before building anything, I had the agent verify that
premise against the live site rather than take my word for it — it found the
actual JSON search endpoint ANU's own page calls
(`GetCourses?SearchText=COMP&SelectedYear=2027`) and the exact markup shape of
a course's Offerings tab, and confirmed on real examples (COMP1720, COMP4020)
that the anomaly was real before any code got written.

> we can basically scrap the guesbook for now, some other elemt will be
> persistent, for now lets make the full list of availible courses for 2027
> sem1

> scrape the COMP section of courses from anus site, even some that say they
> ae on the current big lists do not have a class number in the current
> offering tab of their own page

That grounding changed the design mid-plan: I'd expected the interesting case
to be "claims First Semester but no class number" (`mismatch`), but the first
real scrape run
([`98e7cf3`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-quackyduck826/commit/98e7cf3))
showed that case never actually occurs for COMP courses — the real anomaly is
courses with **zero current offerings at all** (`no_offerings`, 27 of 128),
still sitting in the search results as if live. I corrected the status
categories on the spot rather than ship a category that would always read
empty, re-ran the scrape, and spot-checked the four known cases against ANU's
site by hand before trusting the rest.

From there the build went in small, checkable steps
([`446aee8...4826001`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-quackyduck826/compare/446aee8...4826001)):
the scraper first (fetch + filter, then full page parsing), then the schema
and boot-time reseed, then the course-list page replacing the guestbook, then
the notes feature, then retiring the guestbook's table once nothing
referenced it, then the spec tests. I ran `pnpm check` after every step and
didn't move on until it was green, and checked the rendered page directly
(`astro preview` + `curl`) after the course-list rewrite to confirm the
status groups and filter actually worked before writing the spec assertions
for them.

> yes start enacting the plan stage commits and push them as you go where it
> makes sense

I deployed to Fly after each meaningful commit rather than on a timer, since
a scheduled deploy could catch the repo mid-edit with a broken build; each
deploy was checked against the live URL before moving on.
