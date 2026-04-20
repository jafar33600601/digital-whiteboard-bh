CREATE TABLE `live_quiz_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`quizId` int NOT NULL,
	`state` enum('waiting','question','results','leaderboard','ended') NOT NULL DEFAULT 'waiting',
	`currentQuestionIndex` int NOT NULL DEFAULT 0,
	`questionStartedAt` timestamp,
	`participants` longtext NOT NULL DEFAULT '[]',
	`currentAnswers` longtext NOT NULL DEFAULT '[]',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `live_quiz_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `quiz_questions` ADD `timeLimit` int DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE `quizzes` ADD `quizMode` enum('normal','live') DEFAULT 'normal' NOT NULL;