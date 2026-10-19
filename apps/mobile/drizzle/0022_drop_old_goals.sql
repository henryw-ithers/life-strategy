DROP TABLE `achievement`;--> statement-breakpoint
DROP TABLE `goal`;--> statement-breakpoint
DROP TABLE `goal_condition`;--> statement-breakpoint
DROP TABLE `goal_progress`;--> statement-breakpoint
DROP TABLE `milestone`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_task` (
	`id` text PRIMARY KEY NOT NULL,
	`unit_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`times_per_week` integer DEFAULT 7 NOT NULL,
	`planned_weekdays` text,
	`part_of_day` text,
	`day_order` integer,
	`fortnight_offset` integer DEFAULT 0 NOT NULL,
	`one_off_size` text,
	`one_off_date` text,
	`one_off_due` text,
	`start_minute` integer,
	`end_minute` integer,
	`size` text,
	`allows_partial` integer DEFAULT false NOT NULL,
	`kind` text DEFAULT 'task' NOT NULL,
	`repeat_from` text,
	`repeat_until` text,
	`moved_from_unit_id` text,
	`point_value` integer NOT NULL,
	`rank_in_unit` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`archived_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`unit_id`) REFERENCES `life_unit`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_task`("id", "unit_id", "title", "description", "times_per_week", "planned_weekdays", "part_of_day", "day_order", "fortnight_offset", "one_off_size", "one_off_date", "one_off_due", "start_minute", "end_minute", "size", "allows_partial", "kind", "repeat_from", "repeat_until", "moved_from_unit_id", "point_value", "rank_in_unit", "active", "archived_at", "created_at", "updated_at") SELECT "id", "unit_id", "title", "description", "times_per_week", "planned_weekdays", "part_of_day", "day_order", "fortnight_offset", "one_off_size", "one_off_date", "one_off_due", "start_minute", "end_minute", "size", "allows_partial", "kind", "repeat_from", "repeat_until", "moved_from_unit_id", "point_value", "rank_in_unit", "active", "archived_at", "created_at", "updated_at" FROM `task`;--> statement-breakpoint
DROP TABLE `task`;--> statement-breakpoint
ALTER TABLE `__new_task` RENAME TO `task`;--> statement-breakpoint
PRAGMA foreign_keys=ON;