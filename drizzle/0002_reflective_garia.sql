CREATE TABLE `user_ledgers` (
	`owner` text PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`payload` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "user_valid_payload" CHECK(json_valid("user_ledgers"."payload")),
	CONSTRAINT "user_positive_revision" CHECK("user_ledgers"."revision" >= 0),
	CONSTRAINT "user_document_version" CHECK(json_extract("user_ledgers"."payload", '$.schemaVersion') IS 1)
);
--> statement-breakpoint
CREATE TRIGGER user_ledgers_owner_immutable
BEFORE UPDATE OF owner ON user_ledgers
WHEN NEW.owner <> OLD.owner
BEGIN
 SELECT RAISE(ABORT, 'Ledger owner is immutable');
END;
