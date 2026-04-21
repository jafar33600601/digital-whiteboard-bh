CREATE TABLE `padlet_boards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shareCode` varchar(32) NOT NULL,
	`teacherId` int NOT NULL,
	`title` varchar(255) NOT NULL DEFAULT 'لوحة جديدة',
	`description` text,
	`layout` enum('grid','stream','freeform') NOT NULL DEFAULT 'grid',
	`bgColor` varchar(32) NOT NULL DEFAULT '#f8fafc',
	`allowStudentCards` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `padlet_boards_id` PRIMARY KEY(`id`),
	CONSTRAINT `padlet_boards_shareCode_unique` UNIQUE(`shareCode`)
);
--> statement-breakpoint
CREATE TABLE `padlet_cards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`boardId` int NOT NULL,
	`authorName` varchar(255) NOT NULL,
	`isTeacher` int NOT NULL DEFAULT 0,
	`title` varchar(255),
	`content` text,
	`imageUrl` text,
	`imageKey` varchar(512),
	`likes` int NOT NULL DEFAULT 0,
	`isPinned` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `padlet_cards_id` PRIMARY KEY(`id`)
);
