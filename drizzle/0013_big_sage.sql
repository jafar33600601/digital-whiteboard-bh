CREATE TABLE `quizizz_progress` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`studentName` varchar(255) NOT NULL,
	`currentQuestion` int NOT NULL DEFAULT 0,
	`questionsCompleted` int NOT NULL DEFAULT 0,
	`score` int NOT NULL DEFAULT 0,
	`answers` longtext NOT NULL,
	`isFinished` int NOT NULL DEFAULT 0,
	`finishedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quizizz_progress_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quizizz_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`quizId` int NOT NULL,
	`shareCode` varchar(32) NOT NULL,
	`state` enum('waiting','active','ended') NOT NULL DEFAULT 'waiting',
	`endsAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quizizz_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `quizizz_sessions_shareCode_unique` UNIQUE(`shareCode`)
);
