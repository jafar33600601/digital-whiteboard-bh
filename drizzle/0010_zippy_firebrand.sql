CREATE TABLE `banned_ips` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ipAddress` varchar(64) NOT NULL,
	`reason` text,
	`bannedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	CONSTRAINT `banned_ips_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `live_quiz_sessions` ADD `isLocked` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `live_quiz_sessions` ADD `kickedParticipants` longtext DEFAULT '[]' NOT NULL;