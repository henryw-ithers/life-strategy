ALTER TABLE `life_unit` ADD `uses_sub_commitments` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `task` ADD `kind` text DEFAULT 'task' NOT NULL;--> statement-breakpoint
ALTER TABLE `task` ADD `location` text;