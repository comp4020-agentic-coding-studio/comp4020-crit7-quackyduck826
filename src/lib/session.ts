// ANU's own session names, abbreviated for a table cell that otherwise runs
// wide — "Quarter 1/First Semester/Quarter 2/Quarter 3/Second Semester/
// Quarter 4" becomes "Q1/Sem 1/Q2/Q3/Sem 2/Q4". Shared by "/" and
// "/my-courses/" so both render a course's offering the same way.
const SESSION_ABBREVIATIONS: Record<string, string> = {
  "First Semester": "Sem 1",
  "Second Semester": "Sem 2",
  "Quarter 1": "Q1",
  "Quarter 2": "Q2",
  "Quarter 3": "Q3",
  "Quarter 4": "Q4",
};

export function abbreviateSession(session: string): string {
  if (!session) return "(not listed)";
  return session
    .split("/")
    .map((part) => SESSION_ABBREVIATIONS[part.trim()] ?? part.trim())
    .join("/");
}
