PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_rating` (
	`snapshot_id` text NOT NULL,
	`unit_id` text NOT NULL,
	`importance` real NOT NULL,
	`satisfaction` real NOT NULL,
	`effort_points` real,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`snapshot_id`, `unit_id`),
	FOREIGN KEY (`snapshot_id`) REFERENCES `snapshot`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`unit_id`) REFERENCES `life_unit`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_rating`("snapshot_id", "unit_id", "importance", "satisfaction", "effort_points", "created_at", "updated_at") SELECT "snapshot_id", "unit_id", "importance", "satisfaction", "effort_points", "created_at", "updated_at" FROM `rating`;--> statement-breakpoint
DROP TABLE `rating`;--> statement-breakpoint
ALTER TABLE `__new_rating` RENAME TO `rating`;--> statement-breakpoint
PRAGMA foreign_keys=ON;