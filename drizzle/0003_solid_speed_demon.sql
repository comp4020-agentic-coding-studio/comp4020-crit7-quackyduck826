ALTER TABLE `courses` ADD `first_sem_class_number` text;--> statement-breakpoint
ALTER TABLE `courses` ADD `second_sem_class_number` text;--> statement-breakpoint
ALTER TABLE `courses` ADD `has_any_offering` integer DEFAULT false NOT NULL;
