CREATE TABLE `achievement` (
	`id` text PRIMARY KEY NOT NULL,
	`goal_id` text,
	`title_snapshot` text NOT NULL,
	`achieved_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`goal_id`) REFERENCES `goal`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `goal` (
	`id` text PRIMARY KEY NOT NULL,
	`unit_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`kind` text NOT NULL,
	`target_value` real,
	`counts_whole_unit` integer DEFAULT false NOT NULL,
	`target_date` text,
	`status` text DEFAULT 'active' NOT NULL,
	`status_changed_at` text,
	`linked_from_goal_id` text,
	`link_kind` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`unit_id`) REFERENCES `life_unit`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`linked_from_goal_id`) REFERENCES `goal`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `goal_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`goal_id` text NOT NULL,
	`completion_id` text NOT NULL,
	`task_id` text NOT NULL,
	`local_date` text NOT NULL,
	`minutes` real NOT NULL,
	`points` real NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`goal_id`) REFERENCES `goal`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`completion_id`) REFERENCES `task_completion`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `goal_task` (
	`goal_id` text NOT NULL,
	`task_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`goal_id`, `task_id`),
	FOREIGN KEY (`goal_id`) REFERENCES `goal`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`task_id`) REFERENCES `task`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `task_completion` ADD `actual_minutes` integer;