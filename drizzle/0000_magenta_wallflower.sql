CREATE TABLE `ledger` (
	`id` integer PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`payload` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "singleton" CHECK("ledger"."id" = 1),
	CONSTRAINT "valid_payload" CHECK(json_valid("ledger"."payload")),
	CONSTRAINT "positive_revision" CHECK("ledger"."revision" >= 0)
);
