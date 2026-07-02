CREATE TABLE `contact_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`senderName` varchar(255) NOT NULL,
	`senderEmail` varchar(255) NOT NULL,
	`subject` varchar(500) NOT NULL,
	`message` text NOT NULL,
	`adminReply` text,
	`repliedAt` timestamp,
	`status` enum('new','read','replied') NOT NULL DEFAULT 'new',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contact_messages_id` PRIMARY KEY(`id`)
);
