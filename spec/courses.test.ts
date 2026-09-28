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

  it("filtering by offering shows only courses with a current offering that semester", async () => {
    const included = snapshot.courses.filter((c) => c.hasAnyOffering === false).map((c) => c.courseCode);
    const excluded = snapshot.courses.filter((c) => c.hasAnyOffering !== false).map((c) => c.courseCode);
    expect(included.length).toBeGreaterThan(0);

    const res = await fetch(new URL("/?offering=no_offerings", baseUrl));
    const html = await res.text();
    for (const code of included) expect(html).toContain(code);
    for (const code of excluded) expect(html).not.toContain(code);
  });

  it("filtering by level shows only courses at that level", async () => {
    const level = 1000;
    const included = snapshot.courses
      .filter((c) => Number(c.courseCode[4]) * 1000 === level)
      .map((c) => c.courseCode);
    const excluded = snapshot.courses
      .filter((c) => Number(c.courseCode[4]) * 1000 !== level)
      .map((c) => c.courseCode);
    expect(included.length).toBeGreaterThan(0);

    const res = await fetch(new URL(`/?level=${level}`, baseUrl));
    const html = await res.text();
    for (const code of included) expect(html).toContain(code);
    for (const code of excluded) expect(html).not.toContain(code);
  });

  it("ticking multiple levels shows courses from any of them (OR, not AND)", async () => {
    const included = snapshot.courses
      .filter((c) => [1000, 2000].includes(Number(c.courseCode[4]) * 1000))
      .map((c) => c.courseCode);
    const excluded = snapshot.courses
      .filter((c) => ![1000, 2000].includes(Number(c.courseCode[4]) * 1000))
      .map((c) => c.courseCode);
    expect(included.length).toBeGreaterThan(0);
    expect(excluded.length).toBeGreaterThan(0);

    const res = await fetch(new URL("/?level=1000&level=2000", baseUrl));
    const html = await res.text();
    for (const code of included) expect(html).toContain(code);
    for (const code of excluded) expect(html).not.toContain(code);
  });

  it("ticking multiple offerings shows courses matching any of them", async () => {
    const included = snapshot.courses
      .filter((c) => c.firstSemClassNumber !== null || !c.hasAnyOffering)
      .map((c) => c.courseCode);
    const excluded = snapshot.courses
      .filter((c) => c.firstSemClassNumber === null && c.hasAnyOffering)
      .map((c) => c.courseCode);
    expect(included.length).toBeGreaterThan(0);
    expect(excluded.length).toBeGreaterThan(0);

    const res = await fetch(new URL("/?offering=first_sem&offering=no_offerings", baseUrl));
    const html = await res.text();
    for (const code of included) expect(html).toContain(code);
    for (const code of excluded) expect(html).not.toContain(code);
  });
});
