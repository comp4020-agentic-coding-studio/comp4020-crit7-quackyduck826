// Scrapes ANU's course site for every COMP-prefixed course and checks whether
// it's actually running First Semester 2027 by reading its own page's
// Offerings tab — not just what the catalogue search claims. Run with
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

// "confirmed": a real class number for First Semester 2027.
// "mismatch": the catalogue search claims First Semester, but the course's
//   own page has other offerings and none of them is First Semester 2027 —
//   the headline anomaly the brief targets, when it occurs.
// "no_offerings": the course's own page has NO current offerings at all
//   (any session, any year), despite sitting in ANU's course search as if it
//   were a live course — the more common version of the same anomaly.
// "other_semester": the course's own page confirms it genuinely runs, just
//   not First Semester 2027 — a legitimate exclusion, not a red flag.
type CourseStatus = "confirmed" | "mismatch" | "no_offerings" | "other_semester";

interface CourseRecord {
  courseCode: string;
  name: string;
  catalogueSession: string;
  catalogueClaimsS1: boolean;
  classNumber: string | null;
  status: CourseStatus;
}

async function fetchCompCourses(): Promise<CatalogueCourse[]> {
  const res = await fetch(SEARCH_URL);
  if (!res.ok) throw new Error(`catalogue search failed: ${res.status}`);
  const data = (await res.json()) as { TotalCount: number; Items: CatalogueCourse[] };
  return data.Items.filter((item) => item.CourseCode.startsWith("COMP"));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Reads a course's own Offerings tab for 2027: whether it has ANY current
 *  offering at all, and the real class number for First Semester 2027 if
 *  one exists. Each session actually offered gets its own `<h3>` under the
 *  year's tab, immediately followed by a `table.table-terms` whose first
 *  cell is the class number; a course with zero offerings shows plain text
 *  instead of the tabs container entirely. */
function readOfferings($: cheerio.CheerioAPI): { hasAnyOffering: boolean; classNumber: string | null } {
  const yearTabLink = $(".course-tabs-menu .course-tab a").filter(
    (_, el) => $(el).text().trim() === "2027",
  );
  if (yearTabLink.length === 0) return { hasAnyOffering: false, classNumber: null };

  const tabId = yearTabLink.attr("href")?.replace("#", "");
  const tabContent = tabId ? $(`#${tabId}`) : $();
  if (tabContent.length === 0) return { hasAnyOffering: false, classNumber: null };

  const heading = tabContent
    .find("h3")
    .filter((_, el) => $(el).text().trim() === "First Semester")
    .first();
  if (heading.length === 0) return { hasAnyOffering: true, classNumber: null };

  const table = heading.nextAll("table.table-terms").first();
  const classNumber = table.find("tbody tr").first().find("td").first().text().trim();
  return { hasAnyOffering: true, classNumber: classNumber || null };
}

async function scrapeCourse(course: CatalogueCourse): Promise<CourseRecord> {
  const catalogueClaimsS1 = course.Session.includes("First Semester");
  const url = `https://programsandcourses.anu.edu.au/2027/course/${course.CourseCode.toLowerCase()}`;

  let hasAnyOffering = false;
  let classNumber: string | null = null;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status}`);
    const $ = cheerio.load(await res.text());
    ({ hasAnyOffering, classNumber } = readOfferings($));
  } catch (err) {
    console.warn(`  ! ${course.CourseCode}: failed to scrape (${(err as Error).message}), treating as no offerings`);
  }

  const status: CourseStatus = classNumber
    ? "confirmed"
    : !hasAnyOffering
      ? "no_offerings"
      : catalogueClaimsS1
        ? "mismatch"
        : "other_semester";

  return {
    courseCode: course.CourseCode,
    name: course.Name.trim(),
    catalogueSession: course.Session,
    catalogueClaimsS1,
    classNumber,
    status,
  };
}

const catalogueCourses = await fetchCompCourses();
console.log(`found ${catalogueCourses.length} COMP courses in the 2027 catalogue`);

const courses: CourseRecord[] = [];
for (const [index, course] of catalogueCourses.entries()) {
  const record = await scrapeCourse(course);
  courses.push(record);
  console.log(
    `  [${index + 1}/${catalogueCourses.length}] ${record.courseCode} -> ${record.status}` +
      (record.classNumber ? ` (class ${record.classNumber})` : ""),
  );
  await sleep(REQUEST_DELAY_MS);
}

const scrapedAt = new Date().toISOString();
await writeFile(OUTPUT_PATH, JSON.stringify({ scrapedAt, courses }, null, 2) + "\n");

const counts = courses.reduce(
  (acc, c) => ({ ...acc, [c.status]: (acc[c.status] ?? 0) + 1 }),
  {} as Record<CourseStatus, number>,
);
console.log(`\nwrote ${courses.length} courses to ${OUTPUT_PATH.pathname}`);
console.log(counts);
