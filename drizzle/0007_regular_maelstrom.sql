CREATE TABLE `taken_courses` (
	`course_code` text PRIMARY KEY NOT NULL,
	`taken_at` text DEFAULT (datetime('now')) NOT NULL
);
