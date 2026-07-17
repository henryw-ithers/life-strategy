ALTER TABLE `task` ADD `interval_days` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
UPDATE `task` SET `interval_days` = CASE `cadence` WHEN 'weekly' THEN 7 ELSE 1 END;