import { describe, expect, inject, it } from "vitest";
import snapshot from "../data/courses-2027-sem1.json";

// Contracts against the running app, not against which specific courses
// land where — robust to a future re-scrape changing ANU's data.
const baseUrl = inject("baseUrl");

const ALL_OFFERINGS = ["first_sem", "second_sem", "no_offerings"];
const ALL_LEVELS = [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000];

// A real submission always carries every currently-ticked box from BOTH
// groups — so isolating "just the offering filter" in a test means leaving
// every level box ticked (the default), not omitting the level params
// entirely (which the app reads as "every level box was unticked").
function filterUrl(opts: { offerings?: string[]; levels?: number[] }): URL {
  const params = new URLSearchParams({ submitted: "1" });
  for (const o of opts.offerings ?? ALL_OFFERINGS) params.append("offering", o);
  for (const l of opts.levels ?? ALL_LEVELS) params.append("level", String(l));
  return new URL(`/?${params}`, baseUrl);
}

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

  it("on first load, before the form is submitted, every offering/level checkbox is ticked", async () => {
    // "Show liked first" is a separate sort toggle, not part of this
    // all-ticked-by-default guarantee, so it's excluded by name here.
    const res = await fetch(baseUrl);
    const html = await res.text();
    const checkboxes = html.match(/<input type="checkbox" name="(?:offering|level)"[^>]*>/g) ?? [];
    expect(checkboxes.length).toBeGreaterThan(0);
    expect(checkboxes.every((tag) => tag.includes("checked"))).toBe(true);
  });

  it("filtering by offering shows only courses with a current offering that semester", async () => {
    const included = snapshot.courses.filter((c) => c.hasAnyOffering === false).map((c) => c.courseCode);
    const excluded = snapshot.courses.filter((c) => c.hasAnyOffering !== false).map((c) => c.courseCode);
    expect(included.length).toBeGreaterThan(0);

    const res = await fetch(filterUrl({ offerings: ["no_offerings"] }));
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
    expect(excluded.length).toBeGreaterThan(0);

    const res = await fetch(filterUrl({ levels: [level] }));
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

    const res = await fetch(filterUrl({ levels: [1000, 2000] }));
    const html = await res.text();
    for (const code of included) expect(html).toContain(code);
    for (const code of excluded) expect(html).not.toContain(code);
  });

  it("has a checkbox for every level actually present in the data", async () => {
    const dataLevels = new Set(snapshot.courses.map((c) => Number(c.courseCode[4]) * 1000));
    const res = await fetch(baseUrl);
    const html = await res.text();
    for (const level of dataLevels) {
      expect(html).toContain(`name="level" value="${level}"`);
    }
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

    const res = await fetch(filterUrl({ offerings: ["first_sem", "no_offerings"] }));
    const html = await res.text();
    for (const code of included) expect(html).toContain(code);
    for (const code of excluded) expect(html).not.toContain(code);
  });

  it("submitting with every box in a group unticked shows nothing from that group", async () => {
    const res = await fetch(filterUrl({ offerings: [] }));
    const html = await res.text();
    expect(html).toContain("Showing 0 of");
  });

  it("labels the session column 'Running in'", async () => {
    const res = await fetch(baseUrl);
    const html = await res.text();
    expect(html).toContain("Running in");
  });

  it("abbreviates semester and quarter names in the session column", async () => {
    const res = await fetch(baseUrl);
    const html = await res.text();
    // Scoped to the table body — the offering filter's own checkbox labels
    // ("First Semester" etc.) are spelled out in full on purpose.
    const rows = html.slice(html.indexOf("<tbody>"), html.indexOf("</tbody>"));
    expect(rows).not.toContain("First Semester");
    expect(rows).not.toContain("Second Semester");
    expect(rows).not.toContain("Quarter 1");
    // A course confirmed running First Semester and abbreviated as "Sem 1"
    // actually appears — this isn't just "the words never show up".
    expect(rows).toContain("Sem 1");
  });
});
