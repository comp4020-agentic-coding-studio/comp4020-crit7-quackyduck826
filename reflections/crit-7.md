# Crit 7 reflection

**The breakthrough** was making the agent verify the premise against the live
site before writing any code. My starting idea — courses that claim to be
running but have no class number — turned out not to be the real pattern once
the full scrape ran: what actually happens is courses with zero offerings at
all, still sitting in the search results as if active. If I'd designed the
schema around my assumption first and only scraped afterward, I'd have shipped
a status category that was permanently empty and missed the more common,
more interesting anomaly. Checking the data before locking in the model —
rather than locking in the model and hoping the data matched it — was the
actual unlock, and it's a habit I want from now on: let the real fetch
correct the plan, not the other way round.

**What this changed about who I want to be as a developer** is how I think
about trusting a scraped or third-party data source. It's easy to write a
scraper that "runs successfully" and quietly encodes a wrong assumption about
what it found. The thing that made this trustworthy wasn't more code, it was
spot-checking known cases by hand against ANU's own site before writing the
spec tests, and then writing those tests against the scraper's own output
rather than hardcoded course codes, so they'd stay honest under a future
re-scrape instead of just asserting today's snapshot. I want that same
instinct — verify against the source, then write tests that check the
relationship rather than a fixed answer — anywhere I'm building on data I
don't control.
