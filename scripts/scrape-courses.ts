// Scrapes ANU's course site for every COMP-prefixed course and checks whether
// it's actually running First Semester 2027 by reading its own page's
// Offerings tab — not just what the catalogue search claims. Run with
// `pnpm run scrape:courses`; writes data/courses-2027-sem1.json, which
// src/lib/db.ts imports and reseeds the courses table from on every boot.
//
// Step 1 (this commit): fetch the catalogue search, filter to COMP courses,
// and confirm the candidate list looks right before scraping ~128 course
// pages one at a time.
const SEARCH_URL =
  "https://programsandcourses.anu.edu.au/data/CourseSearch/GetCourses?SearchText=COMP&MaxPageSize=500&PageSize=500&SelectedYear=2027";

interface CatalogueCourse {
  CourseCode: string;
  Name: string;
  Session: string;
  Career: string;
  Units: number;
  ModeOfDelivery: string;
  Year: number;
}

async function fetchCompCourses(): Promise<CatalogueCourse[]> {
  const res = await fetch(SEARCH_URL);
  if (!res.ok) throw new Error(`catalogue search failed: ${res.status}`);
  const data = (await res.json()) as { TotalCount: number; Items: CatalogueCourse[] };
  return data.Items.filter((item) => item.CourseCode.startsWith("COMP"));
}

const courses = await fetchCompCourses();
console.log(`found ${courses.length} COMP courses in the 2027 catalogue`);
for (const course of courses.slice(0, 5)) {
  console.log(`  ${course.CourseCode} — ${course.Name.trim()} (session: "${course.Session}")`);
}
