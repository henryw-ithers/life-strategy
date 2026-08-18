PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_achievement` (
	`id` text PRIMARY KEY NOT NULL,
	`goal_id` text,
	`milestone_id` text,
	`title_snapshot` text NOT NULL,
	`achieved_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`goal_id`) REFERENCES `goal`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`milestone_id`) REFERENCES `milestone`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_achievement`("id", "goal_id", "milestone_id", "title_snapshot", "achieved_at", "created_at", "updated_at") SELECT "id", "goal_id", "milestone_id", "title_snapshot", "achieved_at", "created_at", "updated_at" FROM `achievement`;--> statement-breakpoint
DROP TABLE `achievement`;--> statement-breakpoint
ALTER TABLE `__new_achievement` RENAME TO `achievement`;--> statement-breakpoint
PRAGMA foreign_keys=ON;