ALTER TABLE `padlet_boards` ADD `requireApproval` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `padlet_cards` ADD `isPublished` int DEFAULT 1 NOT NULL;