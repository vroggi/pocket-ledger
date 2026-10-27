CREATE TRIGGER ledger_owner_immutable
BEFORE UPDATE OF owner ON ledger
WHEN NEW.owner <> OLD.owner
BEGIN
 SELECT RAISE(ABORT, 'Ledger owner is immutable');
END;
--> statement-breakpoint
CREATE TRIGGER ledger_document_version_insert
BEFORE INSERT ON ledger
WHEN json_extract(NEW.payload, '$.schemaVersion') IS NOT 1
BEGIN
 SELECT RAISE(ABORT, 'Unsupported ledger document');
END;
--> statement-breakpoint
CREATE TRIGGER ledger_document_version_update
BEFORE UPDATE OF payload ON ledger
WHEN json_extract(NEW.payload, '$.schemaVersion') IS NOT 1
BEGIN
 SELECT RAISE(ABORT, 'Unsupported ledger document');
END;
