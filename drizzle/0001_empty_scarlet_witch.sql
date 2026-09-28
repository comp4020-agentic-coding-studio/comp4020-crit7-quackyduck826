CREATE TABLE `course_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`course_code` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `courses` (
	`course_code` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`catalogue_session` text DEFAULT '' NOT NULL,
	`catalogue_claims_s1` integer NOT NULL,
	`class_number` text,
	`status` text NOT NULL,
	`scraped_at` text NOT NULL
);
