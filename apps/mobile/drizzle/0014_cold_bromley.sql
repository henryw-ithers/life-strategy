ALTER TABLE `life_unit` ADD `parent_unit_id` text REFERENCES life_unit(id);--> statement-breakpoint
ALTER TABLE `life_unit` ADD `commitment_share` real;