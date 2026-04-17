ALTER TABLE `aiMessages` MODIFY COLUMN `citations` json;--> statement-breakpoint
ALTER TABLE `recordings` MODIFY COLUMN `tags` json;--> statement-breakpoint
ALTER TABLE `transcriptions` MODIFY COLUMN `segments` json;--> statement-breakpoint
ALTER TABLE `transcriptions` MODIFY COLUMN `speakerLabels` json;