import { afterAll, describe, expect, inject, it } from "vitest";
import snapshot from "../data/courses-2027-sem1.json";

// The "/my-courses/" contract: it's the union of liked and taken courses,
// nothing else. Distinct probes from spec/likes.test.ts and
// spec/taken.test.ts so writes across files never touch the same row.
const baseUrl = inject("baseUrl");

const sortedByCode = [...snapshot.courses].sort((a, b) => a.courseCode.localeCompare(b.courseCode));
const likedProbe = sortedByCode[3];
const takenProbe = sortedByCode[4];
const untouchedProbe = sortedByCode[5];

const postLike = (courseCode: string) =>
  fetch(new URL("/api/likes", baseUrl), {
    method: "POST",
    headers: { origin: baseUrl },
    body: new URLSearchParams({ courseCode, returnTo: "/my-courses/" }),
    redirect: "manual",
  });

const postTaken = (courseCode: string) =>
  fetch(new URL("/api/taken", baseUrl), {
    method: "POST",
    headers: { origin: baseUrl },
    body: new URLSearchParams({ courseCode, returnTo: "/my-courses/" }),
    redirect: "manual",
  });

describe("/my-courses/", () => {
  afterAll(async () => {
    const res = await fetch(new URL("/my-courses/", baseUrl));
    const html = await res.text();
    for (const code of [likedProbe.courseCode, takenProbe.courseCode]) {
      if (html.includes(`aria-label="Unlike ${code}"`)) await postLike(code);
      if (html.includes(`aria-label="Unmark ${code} as taken"`)) await postTaken(code);
    }
  });

  it("is empty of an untouched course", async () => {
    const res = await fetch(new URL("/my-courses/", baseUrl));
    const html = await res.text();
    expect(html).not.toContain(`>${untouchedProbe.courseCode}<`);
  });

  it("shows a liked course", async () => {
    await postLike(likedProbe.courseCode);
    const res = await fetch(new URL("/my-courses/", baseUrl));
    const html = await res.text();
    expect(html).toContain(`>${likedProbe.courseCode}<`);
  });

  it("shows a taken course", async () => {
    await postTaken(takenProbe.courseCode);
    const res = await fetch(new URL("/my-courses/", baseUrl));
    const html = await res.text();
    expect(html).toContain(`>${takenProbe.courseCode}<`);
  });

  it("drops a course once it's neither liked nor taken", async () => {
    await postLike(likedProbe.courseCode);
    const res = await fetch(new URL("/my-courses/", baseUrl));
    const html = await res.text();
    expect(html).not.toContain(`>${likedProbe.courseCode}<`);
  });
});
