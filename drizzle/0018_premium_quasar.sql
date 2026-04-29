ALTER TABLE `classrooms` MODIFY COLUMN `userId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `wheel_questions` MODIFY COLUMN `userId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `wheel_questions` MODIFY COLUMN `options` longtext NOT NULL;