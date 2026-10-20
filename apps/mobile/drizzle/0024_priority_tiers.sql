ALTER TABLE `task` ADD `paused_for_not_now` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `unit_weight` ADD `tier` text;--> statement-breakpoint
ALTER TABLE `unit_weight` ADD `tier_order` integer;