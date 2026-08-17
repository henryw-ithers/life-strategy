CREATE TABLE `goal_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`goal_id` text NOT NULL,
	`local_date` text NOT NULL,
	`value` real NOT NULL,
	`note` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`goal_id`) REFERENCES `goal`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `planned_occurrence` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`local_date` text NOT NULL,
	`part_of_day` text,
	`archived_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `task`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `task_completion_tag` (
	`completion_id` text NOT NULL,
	`unit_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`completion_id`, `unit_id`),
	FOREIGN KEY (`completion_id`) REFERENCES `task_completion`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`unit_id`) REFERENCES `life_unit`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `goal` ADD `metric_kind` text;--> statement-breakpoint
ALTER TABLE `goal` ADD `metric_unit` text;--> statement-breakpoint
ALTER TABLE `goal` ADD `target_date` text;--> statement-breakpoint
ALTER TABLE `goal` ADD `autocount_task_id` text REFERENCES task(id);--> statement-breakpoint
ALTER TABLE `life_unit` ADD `motivation_kind` text DEFAULT 'instrumental' NOT NULL;--> statement-breakpoint
ALTER TABLE `milestone` ADD `target_value` real;--> statement-breakpoint
ALTER TABLE `milestone` ADD `completed_on` text;--> statement-breakpoint
ALTER TABLE `task` ADD `planned_weekdays` text;--> statement-breakpoint
ALTER TABLE `task` ADD `part_of_day` text;--> statement-breakpoint
ALTER TABLE `task_unit` ADD `membership` text DEFAULT 'scoring' NOT NULL;