import { describe, expect, inject, it } from "vitest";
import snapshot from "../data/courses-2027-sem1.json";

// Contracts against the running app, not against which specific courses
// land where — robust to a future re-scrape changing ANU's data.
const baseUrl = inject("baseUrl");

describe("course list", () => {
  it("scraped at least 100 COMP courses", () => {
    expect(snapshot.courses.length).toBeGreaterThanOrEqual(100);
  });

  it("responds 200 and lists every scraped course code", async () => {
    const res = await fetch(baseUrl);
    expect(res.status).toBe(200);
    const html = await res.text();
    for (const course of snapshot.courses) {
      expect(html).toContain(course.courseCode);
    }
  });

  it("links each course out to its own ANU page", async () => {
    const res = await fetch(baseUrl);
    const html = await res.text();
    expect(html).toContain("programsandcourses.anu.edu.au/2027/course/");
  });

  it("filtering by status shows only courses carrying that status", async () => {
    const status = "no_offerings";
    const included = snapshot.courses.filter((c) => c.status === status).map((c) => c.courseCode);
    const excluded = snapshot.courses.filter((c) => c.status !== status).map((c) => c.courseCode);
    expect(included.length).toBeGreaterThan(0);

    const res = await fetch(new URL(`/?status=${status}`, baseUrl));
    const html = await res.text();
    for (const code of included) expect(html).toContain(code);
    for (const code of excluded) expect(html).not.toContain(code);
  });
});
