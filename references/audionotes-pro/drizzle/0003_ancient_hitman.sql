ALTER TABLE `users` ADD `googleDriveEnabled` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `users` ADD `googleDriveFolderId` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `googleDriveFolderName` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `googleAccessToken` text;--> statement-breakpoint
ALTER TABLE `users` ADD `googleRefreshToken` text;--> statement-breakpoint
ALTER TABLE `users` ADD `googleTokenExpiry` timestamp;