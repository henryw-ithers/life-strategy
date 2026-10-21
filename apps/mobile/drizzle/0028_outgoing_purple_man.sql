CREATE TABLE `achievement` (
	`id` text PRIMARY KEY NOT NULL,
	`series` text NOT NULL,
	`subject_kind` text NOT NULL,
	`subject_id` text NOT NULL,
	`subject_name` text NOT NULL,
	`rank` text NOT NULL,
	`threshold` integer NOT NULL,
	`earned_on` text NOT NULL,
	`celebrated_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `achievement_rank` ON `achievement` (`series`,`subject_id`,`rank`);