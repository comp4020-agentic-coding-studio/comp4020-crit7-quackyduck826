import type { APIRoute } from "astro";
import { toggleTaken } from "../../lib/db";

// Where to send the browser back to after a toggle — validated as a
// same-site relative path so a crafted "returnTo" can't redirect elsewhere.
function safeReturnTo(value: FormDataEntryValue | null): string {
  const path = typeof value === "string" ? value : "";
  return path.startsWith("/") && !path.startsWith("//") ? path : "/";
}

// Mirrors src/pages/api/likes.ts: a plain HTML form POSTs here (the taken
// toggle on each course row), the toggle applies, and a 303 redirect back to
// wherever the row was re-renders from the database. That redirect is the
// no-JS fallback; public/toggle.js intercepts the same submit and asks for
// JSON instead, so a browser with scripting on updates the button in place
// with no navigation at all.
export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();
  const courseCode = String(form.get("courseCode") ?? "")
    .trim()
    .toUpperCase();
  const returnTo = safeReturnTo(form.get("returnTo"));
  const taken = courseCode ? toggleTaken(courseCode) : false;
  if (request.headers.get("accept")?.includes("application/json")) {
    return new Response(JSON.stringify({ courseCode, taken }), {
      headers: { "content-type": "application/json" },
    });
  }
  return redirect(returnTo, 303);
};
