import { afterAll, describe, expect, inject, it } from "vitest";
import snapshot from "../data/courses-2027-sem1.json";

// Mirrors spec/likes.test.ts's contract for the independent "taken" toggle.
const baseUrl = inject("baseUrl");

// Distinct probes from spec/likes.test.ts's (first/last), so the two files'
// writes never touch the same row when they run in parallel.
const sortedByCode = [...snapshot.courses].sort((a, b) => a.courseCode.localeCompare(b.courseCode));
const courseA = sortedByCode[1];
const courseB = sortedByCode[2];

const postTaken = (courseCode: string, returnTo = "/") =>
  fetch(new URL("/api/taken", baseUrl), {
    method: "POST",
    headers: { origin: baseUrl },
    body: new URLSearchParams({ courseCode, returnTo }),
    redirect: "manual",
  });

const postLike = (courseCode: string, returnTo = "/") =>
  fetch(new URL("/api/likes", baseUrl), {
    method: "POST",
    headers: { origin: baseUrl },
    body: new URLSearchParams({ courseCode, returnTo }),
    redirect: "manual",
  });

describe("marking a course taken", () => {
  afterAll(async () => {
    // Leave both probes untaken and unliked, whichever state the tests below
    // land them in, so a re-run of this file starts from the same place.
    const res = await fetch(baseUrl);
    const html = await res.text();
    for (const code of [courseA.courseCode, courseB.courseCode]) {
      if (html.includes(`aria-label="Unmark ${code} as taken"`)) await postTaken(code);
      if (html.includes(`aria-label="Unlike ${code}"`)) await postLike(code);
    }
  });

  it("accepts a taken toggle and redirects back to returnTo", async () => {
    const res = await postTaken(courseA.courseCode, "/?submitted=1");
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/?submitted=1");
  });

  it("persists the toggle: a fresh page load shows it taken", async () => {
    const res = await fetch(baseUrl);
    const html = await res.text();
    expect(html).toContain(`aria-label="Unmark ${courseA.courseCode} as taken"`);
  });

  it("toggles back off on a second toggle", async () => {
    await postTaken(courseA.courseCode);
    const res = await fetch(baseUrl);
    const html = await res.text();
    expect(html).toContain(`aria-label="Mark ${courseA.courseCode} as taken"`);
  });

  it("is independent of liking: marking taken doesn't like, and vice versa", async () => {
    await postTaken(courseB.courseCode);
    const res = await fetch(baseUrl);
    const html = await res.text();
    expect(html).toContain(`aria-label="Unmark ${courseB.courseCode} as taken"`);
    expect(html).toContain(`aria-label="Like ${courseB.courseCode}"`);
  });

  it("hides taken courses from / when the hideTaken filter is on", async () => {
    const res = await fetch(new URL("/?hideTaken=1", baseUrl));
    const html = await res.text();
    expect(html).not.toContain(`>${courseB.courseCode}<`);
  });
});
