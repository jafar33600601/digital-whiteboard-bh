CREATE TABLE `quizizz_banned` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`studentName` varchar(100) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quizizz_banned_id` PRIMARY KEY(`id`)
);
