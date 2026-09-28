import { afterAll, describe, expect, inject, it } from "vitest";
import snapshot from "../data/courses-2027-sem1.json";

// The "create something, it survives a reload" contract, now that liking a
// course replaced the old notes feature.
const baseUrl = inject("baseUrl");

// courseA sorts first and courseB sorts last in the default (courseCode)
// ordering, so "liking courseB puts it before courseA" only holds if the
// sort actually reordered them.
const sortedByCode = [...snapshot.courses].sort((a, b) => a.courseCode.localeCompare(b.courseCode));
const courseA = sortedByCode[0];
const courseB = sortedByCode[sortedByCode.length - 1];

// Astro checks form POSTs carry a same-origin Origin header (CSRF
// protection); browsers send it automatically, a bare fetch doesn't.
const postLike = (courseCode: string, returnTo = "/") =>
  fetch(new URL("/api/likes", baseUrl), {
    method: "POST",
    headers: { origin: baseUrl },
    body: new URLSearchParams({ courseCode, returnTo }),
    redirect: "manual",
  });

describe("liking a course", () => {
  afterAll(async () => {
    // Leave both probes unliked, whichever state the tests below land them
    // in, so a re-run of this file starts from the same place.
    const res = await fetch(baseUrl);
    const html = await res.text();
    for (const code of [courseA.courseCode, courseB.courseCode]) {
      if (html.includes(`aria-label="Unlike ${code}"`)) await postLike(code);
    }
  });

  it("accepts a like and redirects back to returnTo", async () => {
    const res = await postLike(courseA.courseCode, "/?submitted=1");
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/?submitted=1");
  });

  it("persists the like: a fresh page load shows it liked", async () => {
    const res = await fetch(baseUrl);
    const html = await res.text();
    expect(html).toContain(`aria-label="Unlike ${courseA.courseCode}"`);
  });

  it("toggles back off on a second like", async () => {
    await postLike(courseA.courseCode);
    const res = await fetch(baseUrl);
    const html = await res.text();
    expect(html).toContain(`aria-label="Like ${courseA.courseCode}"`);
  });

  it("shows liked courses first when sorted that way", async () => {
    await postLike(courseB.courseCode);
    const res = await fetch(new URL("/?likedFirst=1", baseUrl));
    const html = await res.text();
    expect(html.indexOf(`>${courseB.courseCode}<`)).toBeLessThan(html.indexOf(`>${courseA.courseCode}<`));
  });
});
