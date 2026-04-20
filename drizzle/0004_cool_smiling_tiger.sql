ALTER TABLE `live_quiz_sessions` MODIFY COLUMN `participants` longtext NOT NULL;--> statement-breakpoint
ALTER TABLE `live_quiz_sessions` MODIFY COLUMN `currentAnswers` longtext NOT NULL;--> statement-breakpoint
ALTER TABLE `whiteboard_sessions` ADD `liveSubmissionId` int;