CREATE TABLE `student_submissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`studentName` varchar(255) NOT NULL,
	`canvasData` longtext,
	`correctionData` longtext,
	`status` enum('pending','submitted','corrected') NOT NULL DEFAULT 'pending',
	`submittedAt` timestamp,
	`correctedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `student_submissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `whiteboard_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shareCode` varchar(32) NOT NULL,
	`teacherId` int NOT NULL,
	`title` varchar(255) NOT NULL DEFAULT 'سبورة جديدة',
	`canvasData` longtext,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `whiteboard_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `whiteboard_sessions_shareCode_unique` UNIQUE(`shareCode`)
);
