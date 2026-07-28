CREATE TABLE `task_unit` (
	`task_id` text NOT NULL,
	`unit_id` text NOT NULL,
	`rank_in_unit` integer NOT NULL,
	`point_value` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`task_id`, `unit_id`),
	FOREIGN KEY (`task_id`) REFERENCES `task`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`unit_id`) REFERENCES `life_unit`(`id`) ON UPDATE no action ON DELETE no action
);
