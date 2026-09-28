// Scrapes ANU's course site for every COMP-prefixed course and reads its own
// Offerings tab directly for 2027 — the real class number for First and
// Second Semester, or the absence of any current offering at all — rather
// than trusting what the catalogue search claims. Run with
// `pnpm run scrape:courses`; writes data/courses-2027-sem1.json, which
// src/lib/db.ts imports and reseeds the courses table from on every boot.
import { writeFile } from "node:fs/promises";
import * as cheerio from "cheerio";

const SEARCH_URL =
  "https://programsandcourses.anu.edu.au/data/CourseSearch/GetCourses?SearchText=COMP&MaxPageSize=500&PageSize=500&SelectedYear=2027";
const OUTPUT_PATH = new URL("../data/courses-2027-sem1.json", import.meta.url);
const REQUEST_DELAY_MS = 250;

interface CatalogueCourse {
  CourseCode: string;
  Name: string;
  Session: string;
  Career: string;
  Units: number;
  ModeOfDelivery: string;
  Year: number;
}

interface CourseRecord {
  courseCode: string;
  name: string;
  // ANU's own "Session" field from the catalogue search — what it *claims*,
  // kept alongside the scraped truth so a reader can compare them directly.
  catalogueSession: string;
  // The real class number read from the course's own Offerings page, or
  // null if that session has no offering there. This is the authoritative
  // signal — the catalogue's claim above is not trusted on its own.
  firstSemClassNumber: string | null;
  secondSemClassNumber: string | null;
  // Whether the course's own page has ANY current offering at all (any
  // session, any year). False means it sits in ANU's course search as if
  // live but has nothing scheduled anywhere — the most common surprise.
  hasAnyOffering: boolean;
}

async function fetchCompCourses(): Promise<CatalogueCourse[]> {
  const res = await fetch(SEARCH_URL);
  if (!res.ok) throw new Error(`catalogue search failed: ${res.status}`);
  const data = (await res.json()) as { TotalCount: number; Items: CatalogueCourse[] };
  return data.Items.filter((item) => item.CourseCode.startsWith("COMP"));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Reads a course's own Offerings tab for 2027: whether it has ANY current
 *  offering at all, and the real class number for each semester if one
 *  exists. Each session actually offered gets its own `<h3>` under the
 *  year's tab, immediately followed by a `table.table-terms` whose first
 *  cell is the class number; a course with zero offerings shows plain text
 *  instead of the tabs container entirely. */
function readOfferings(
  $: cheerio.CheerioAPI,
): { hasAnyOffering: boolean; firstSemClassNumber: string | null; secondSemClassNumber: string | null } {
  const none = { hasAnyOffering: false, firstSemClassNumber: null, secondSemClassNumber: null };

  const yearTabLink = $(".course-tabs-menu .course-tab a").filter(
    (_, el) => $(el).text().trim() === "2027",
  );
  if (yearTabLink.length === 0) return none;

  const tabId = yearTabLink.attr("href")?.replace("#", "");
  const tabContent = tabId ? $(`#${tabId}`) : $();
  if (tabContent.length === 0) return none;

  const classNumberFor = (heading: string): string | null => {
    const h3 = tabContent
      .find("h3")
      .filter((_, el) => $(el).text().trim() === heading)
      .first();
    if (h3.length === 0) return null;
    const table = h3.nextAll("table.table-terms").first();
    const classNumber = table.find("tbody tr").first().find("td").first().text().trim();
    return classNumber || null;
  };

  return {
    hasAnyOffering: tabContent.find("h3").length > 0,
    firstSemClassNumber: classNumberFor("First Semester"),
    secondSemClassNumber: classNumberFor("Second Semester"),
  };
}

async function scrapeCourse(course: CatalogueCourse): Promise<CourseRecord> {
  const url = `https://programsandcourses.anu.edu.au/2027/course/${course.CourseCode.toLowerCase()}`;

  let offerings: { hasAnyOffering: boolean; firstSemClassNumber: string | null; secondSemClassNumber: string | null } = {
    hasAnyOffering: false,
    firstSemClassNumber: null,
    secondSemClassNumber: null,
  };
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status}`);
    const $ = cheerio.load(await res.text());
    offerings = readOfferings($);
  } catch (err) {
    console.warn(`  ! ${course.CourseCode}: failed to scrape (${(err as Error).message}), treating as no offerings`);
  }

  return {
    courseCode: course.CourseCode,
    name: course.Name.trim(),
    catalogueSession: course.Session,
    ...offerings,
  };
}

const catalogueCourses = await fetchCompCourses();
console.log(`found ${catalogueCourses.length} COMP courses in the 2027 catalogue`);

const courses: CourseRecord[] = [];
for (const [index, course] of catalogueCourses.entries()) {
  const record = await scrapeCourse(course);
  courses.push(record);
  const bits = [
    record.firstSemClassNumber ? `S1 class ${record.firstSemClassNumber}` : null,
    record.secondSemClassNumber ? `S2 class ${record.secondSemClassNumber}` : null,
    !record.hasAnyOffering ? "no current offerings" : null,
  ].filter(Boolean);
  console.log(`  [${index + 1}/${catalogueCourses.length}] ${record.courseCode} -> ${bits.join(", ") || "none"}`);
  await sleep(REQUEST_DELAY_MS);
}

const scrapedAt = new Date().toISOString();
await writeFile(OUTPUT_PATH, JSON.stringify({ scrapedAt, courses }, null, 2) + "\n");

console.log(`\nwrote ${courses.length} courses to ${OUTPUT_PATH.pathname}`);
console.log({
  firstSem: courses.filter((c) => c.firstSemClassNumber).length,
  secondSem: courses.filter((c) => c.secondSemClassNumber).length,
  noOfferings: courses.filter((c) => !c.hasAnyOffering).length,
});
