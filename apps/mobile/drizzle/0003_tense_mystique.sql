ALTER TABLE `task` ADD `times_per_week` integer DEFAULT 7 NOT NULL;--> statement-breakpoint
UPDATE `task` SET `times_per_week` = MAX(1, MIN(7, CAST(ROUND(7.0 / `interval_days`) AS INTEGER)));