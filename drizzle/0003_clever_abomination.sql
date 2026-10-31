CREATE TABLE `auth_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`attempts` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `auth_limits_expiry` ON `auth_limits` (`expires_at`);--> statement-breakpoint
CREATE TABLE `password_accounts` (
	`provider_id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`email` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `password_accounts_owner_unique` ON `password_accounts` (`owner`);--> statement-breakpoint
CREATE TABLE `password_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`provider_id`) REFERENCES `password_accounts`(`provider_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `password_sessions_expiry` ON `password_sessions` (`expires_at`);