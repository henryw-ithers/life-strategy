CREATE TABLE `pool` (
	`id` text PRIMARY KEY NOT NULL,
	`local_date` text NOT NULL,
	`after_task_id` text,
	`part_of_day` text,
	`planned_count` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`after_task_id`) REFERENCES `task`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `pool_member` (
	`pool_id` text NOT NULL,
	`task_id` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`pool_id`, `task_id`),
	FOREIGN KEY (`pool_id`) REFERENCES `pool`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`task_id`) REFERENCES `task`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `task` ADD `start_minute` integer;--> statement-breakpoint
ALTER TABLE `task` ADD `end_minute` integer;--> statement-breakpoint
ALTER TABLE `task` ADD `size` text;--> statement-breakpoint
ALTER TABLE `task` ADD `allows_partial` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `task_completion` ADD `fraction` real DEFAULT 1 NOT NULL;