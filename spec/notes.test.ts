import { beforeAll, describe, expect, inject, it } from "vitest";

// The "core flow persists across a reload" contract: adding a note is the
// one thing in this app that's real user data, not a scrape.
const baseUrl = inject("baseUrl");

describe("course notes", () => {
  let code: string;
  let body: string;

  beforeAll(() => {
    const probe = process.hrtime.bigint().toString();
    code = `TEST${probe.slice(-4)}`;
    body = `spec probe ${probe}`;
  });

  // Astro checks form POSTs carry a same-origin Origin header (CSRF
  // protection); browsers send it automatically, a bare fetch doesn't.
  const post = (path: string, form: URLSearchParams) =>
    fetch(new URL(path, baseUrl), {
      method: "POST",
      headers: { origin: baseUrl },
      body: form,
      redirect: "manual",
    });

  it("accepts a note and redirects back to /notes/", async () => {
    const res = await post("/api/notes", new URLSearchParams({ courseCode: code, body }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/notes/");
  });

  it("persists the note: a fresh page load includes it", async () => {
    const res = await fetch(new URL("/notes/", baseUrl));
    const html = await res.text();
    expect(html).toContain(code);
    expect(html).toContain(body);
  });

  it("renders notes newest-first", async () => {
    const second = `spec probe ${process.hrtime.bigint()}`;
    await post("/api/notes", new URLSearchParams({ courseCode: code, body: second }));

    const res = await fetch(new URL("/notes/", baseUrl));
    const html = await res.text();
    expect(html.indexOf(second)).toBeLessThan(html.indexOf(body));
  });
});
