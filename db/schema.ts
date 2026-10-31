import { sqliteTable, integer, text, check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
export const ledger = sqliteTable('ledger', {
 id: integer('id').primaryKey(),
 owner: text('owner').notNull(),
 revision: integer('revision').notNull().default(0),
 payload: text('payload').notNull(),
 updatedAt: text('updated_at').notNull(),
}, t => [check('singleton',sql`${t.id} = 1`),check('valid_payload',sql`json_valid(${t.payload})`),check('positive_revision',sql`${t.revision} >= 0`)]);

// Preserve the original singleton for its owner's idempotent migration.
export const userLedgers = sqliteTable('user_ledgers', {
 owner: text('owner').primaryKey().notNull(),
 revision: integer('revision').notNull().default(0),
 payload: text('payload').notNull(),
 updatedAt: text('updated_at').notNull(),
}, t => [check('user_valid_payload',sql`json_valid(${t.payload})`),check('user_positive_revision',sql`${t.revision} >= 0`),check('user_document_version',sql`json_extract(${t.payload}, '$.schemaVersion') IS 1`)]);
