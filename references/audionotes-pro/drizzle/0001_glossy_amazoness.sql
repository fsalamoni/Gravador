CREATE TABLE `actionItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recordingId` int NOT NULL,
	`text` text NOT NULL,
	`assignee` varchar(255),
	`dueDate` varchar(50),
	`priority` enum('high','medium','low') NOT NULL DEFAULT 'medium',
	`isCompleted` boolean NOT NULL DEFAULT false,
	`sourceTimestamp` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `actionItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `aiMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recordingId` int NOT NULL,
	`role` enum('user','assistant') NOT NULL,
	`content` text NOT NULL,
	`citations` json DEFAULT ('[]'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `aiMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mindMaps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recordingId` int NOT NULL,
	`data` json,
	`status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mindMaps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recordings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL DEFAULT 'Untitled Recording',
	`description` text,
	`audioUrl` text,
	`audioKey` text,
	`duration` int NOT NULL DEFAULT 0,
	`fileSize` int DEFAULT 0,
	`mimeType` varchar(50) DEFAULT 'audio/m4a',
	`language` varchar(10) DEFAULT 'auto',
	`recordingMode` enum('ambient','meeting','call','voice_memo') NOT NULL DEFAULT 'ambient',
	`status` enum('recording','saved','uploading','uploaded','error') NOT NULL DEFAULT 'saved',
	`isStarred` boolean NOT NULL DEFAULT false,
	`isSynced` boolean NOT NULL DEFAULT false,
	`tags` json DEFAULT ('[]'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `recordings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `summaries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recordingId` int NOT NULL,
	`templateType` enum('executive','action_items','decisions','feedback','strategic','meeting_notes','custom') NOT NULL DEFAULT 'executive',
	`content` text,
	`status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `summaries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transcriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recordingId` int NOT NULL,
	`fullText` text,
	`language` varchar(10),
	`confidence` float,
	`segments` json DEFAULT ('[]'),
	`speakerLabels` json DEFAULT ('[]'),
	`status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `transcriptions_id` PRIMARY KEY(`id`)
);
