CREATE TABLE `liked_courses` (
	`course_code` text PRIMARY KEY NOT NULL,
	`liked_at` text DEFAULT (datetime('now')) NOT NULL
);
