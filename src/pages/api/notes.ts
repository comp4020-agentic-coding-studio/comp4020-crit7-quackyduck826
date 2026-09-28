import type { APIRoute } from "astro";
import { addNote } from "../../lib/db";

// Mirrors the starter's guestbook write path: a plain HTML form POSTs here,
// the note goes into SQLite, and the 303 redirect re-renders /notes/ from
// the database — no client-side JavaScript required.
export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();
  const courseCode = String(form.get("courseCode") ?? "")
    .trim()
    .slice(0, 20)
    .toUpperCase();
  const body = String(form.get("body") ?? "").trim().slice(0, 500);
  if (courseCode && body) {
    addNote(courseCode, body);
  }
  return redirect("/notes/", 303);
};
