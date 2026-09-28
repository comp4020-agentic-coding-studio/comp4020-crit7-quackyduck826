import type { APIRoute } from "astro";
import { toggleLike } from "../../lib/db";

// Where to send the browser back to after a toggle — validated as a
// same-site relative path so a crafted "returnTo" can't redirect elsewhere.
function safeReturnTo(value: FormDataEntryValue | null): string {
  const path = typeof value === "string" ? value : "";
  return path.startsWith("/") && !path.startsWith("//") ? path : "/";
}

// Mirrors the rest of this app's write path: a plain HTML form POSTs here
// (the like icon on each course row), the toggle applies, and a 303 redirect
// back to wherever the row was — current filters, sort and all — re-renders
// from the database. No client-side JavaScript required.
export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();
  const courseCode = String(form.get("courseCode") ?? "")
    .trim()
    .toUpperCase();
  const returnTo = safeReturnTo(form.get("returnTo"));
  if (courseCode) {
    toggleLike(courseCode);
  }
  return redirect(returnTo, 303);
};
