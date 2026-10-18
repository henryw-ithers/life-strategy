CREATE TABLE `away_range` (
	`id` text PRIMARY KEY NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`label` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `day_clear` (
	`local_date` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `day_window_edit` (
	`id` text PRIMARY KEY NOT NULL,
	`local_date` text NOT NULL,
	`seq` integer NOT NULL,
	`kind` text NOT NULL,
	`start_minute` integer NOT NULL,
	`end_minute` integer NOT NULL,
	`to_start_minute` integer,
	`to_end_minute` integer,
	`made_on` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `schedule_skip` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`task_id` text,
	`unit_id` text,
	`local_date` text NOT NULL,
	`made_on` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `task`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`unit_id`) REFERENCES `life_unit`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `window_choice` (
	`id` text PRIMARY KEY NOT NULL,
	`local_date` text NOT NULL,
	`anchor_minute` integer NOT NULL,
	`planned_count` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `window_choice_member` (
	`choice_id` text NOT NULL,
	`task_id` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`choice_id`, `task_id`),
	FOREIGN KEY (`choice_id`) REFERENCES `window_choice`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`task_id`) REFERENCES `task`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `window_placement` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`kind` text NOT NULL,
	`anchor_minute` integer NOT NULL,
	`repeat` text NOT NULL,
	`local_date` text,
	`extra` integer DEFAULT false NOT NULL,
	`weekdays` text,
	`from_date` text,
	`until_date` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `task`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `window_placement_exception` (
	`placement_id` text NOT NULL,
	`local_date` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`placement_id`, `local_date`),
	FOREIGN KEY (`placement_id`) REFERENCES `window_placement`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `work_day_override` (
	`local_date` text PRIMARY KEY NOT NULL,
	`ranges` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `work_hours` (
	`from_date` text PRIMARY KEY NOT NULL,
	`schedules` text NOT NULL,
	`gaps` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `life_unit` ADD `tier` text;--> statement-breakpoint
ALTER TABLE `life_unit` ADD `tier_order` integer;--> statement-breakpoint
ALTER TABLE `task` ADD `repeat_from` text;--> statement-breakpoint
ALTER TABLE `task` ADD `repeat_until` text;