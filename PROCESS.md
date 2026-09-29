# Process overview

## What I built

A tool that checks every COMP-prefixed course's own ANU page for whether it
actually has a real offering, for either semester of 2027, instead of
trusting the catalogue search's claim: a flat, filterable table of all 128
courses. Each row is likeable (considering it) and independently markable
taken (already done it); `/my-courses/` pulls both together into one
shortlist, and every toggle updates in place with no page reload when
JavaScript is on, falling back to a plain form post when it's off.

## How I got here

The idea came from my own frustration with ANU's course site: you can only
check whether a course is really running by opening its own page, and I'd
noticed some courses sitting in the search results as if active with no real
offering behind them. Before building anything, I had the agent verify that
premise against the live site rather than take my word for it, and it found the
actual JSON search endpoint ANU's own page calls
(`GetCourses?SearchText=COMP&SelectedYear=2027`) and the exact markup shape of
a course's Offerings tab, and confirmed on real examples (COMP1720, COMP4020)
that the anomaly was real before any code got written.

> scrape the COMP section of courses from anus site, even some that say they
> ae on the current big lists do not have a class number in the current
> offering tab of their own page

That grounding changed the design mid-plan: I'd expected the interesting case
to be "claims First Semester but no class number" (`mismatch`), but the first
real scrape run
([`98e7cf3`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-quackyduck826/commit/98e7cf3))
showed that case never actually occurs for COMP courses: the real anomaly is
courses with **zero current offerings at all** (`no_offerings`, 27 of 128),
still sitting in the search results as if live. I corrected the status
categories on the spot rather than ship a category that would always read
empty, re-ran the scrape, and spot-checked the four known cases against ANU's
site by hand before trusting the rest.

From there the build went in small, checkable steps
([`446aee8...4826001`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-quackyduck826/compare/446aee8...4826001)):
the scraper first (fetch + filter, then full page parsing), then the schema
and boot-time reseed, then the course-list page replacing the guestbook, then
a persistent per-course notes feature, then retiring the guestbook's table
once nothing referenced it, then the spec tests. I ran `pnpm check` after
every step and didn't move on until it was green, and checked the rendered
page directly (`astro preview` + `curl`) after the course-list rewrite to
confirm the status groups and filter actually worked before writing the spec
assertions for them.

I deployed to Fly after each meaningful commit rather than on a timer, since
a scheduled deploy could catch the repo mid-edit with a broken build; each
deploy was checked against the live URL before moving on.

## What changed after that first pass

Notes turned out to be the wrong shape for what a reader actually wants to do
with a course list (shortlist candidates to decide between, not leave
commentary), so notes were dropped for a simple like toggle, and ANU's own
session names got abbreviated to fit a table that was starting to run wide
([`3a8a8fd`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-quackyduck826/commit/3a8a8fd)).
The page itself then moved from fixed status groups to one flat table with
tickable offering/level checkboxes (every box ticked by default, so an
untouched filter reads as "show everything" rather than "show nothing"), a
full visual redesign, and a collapsible filter panel that gets out of the way
after a search
([`f237048...a710e3e`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-quackyduck826/compare/f237048...a710e3e)).

Most recently: courses can now be marked taken independently of liked, with
a "hide taken" filter, and `/my-courses/` collects everything liked or taken
into one view, including which semester each course runs
([`fce710c`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-quackyduck826/commit/fce710c)).
The like/taken toggles were originally a plain HTML form post with a
redirect back to the same row: correct, but visibly a full page reload for
something that should feel instant. Rather than replace that mechanism, a
small progressive-enhancement script now intercepts the same submit and asks
the API for JSON instead of a redirect, patching the button (and, on
`/my-courses/`, removing the row once it's no longer liked or taken) in
place; a browser with JavaScript off still gets the original redirect
unchanged. The course table's own height cap came off at the same time, so
the page scrolls naturally with the search bar and the table's header row
both sticking to the top instead of the table scrolling inside its own boxed
region
([`0eb016d`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-quackyduck826/commit/0eb016d)).
Each of these landed with `pnpm check` green and was checked against the
running app (`pnpm dev` + `curl`, including hitting the API directly with an
`Accept: application/json` header to confirm the new JSON contract) before
being deployed and re-verified against the live Fly URL.
