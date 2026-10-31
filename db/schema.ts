import { sqliteTable, integer, text, check, index } from 'drizzle-orm/sqlite-core';
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

export const passwordAccounts=sqliteTable('password_accounts',{
 providerId:text('provider_id').primaryKey().notNull(),
 owner:text('owner').notNull().unique(),
 email:text('email').notNull(),
});
export const passwordSessions=sqliteTable('password_sessions',{
 tokenHash:text('token_hash').primaryKey().notNull(),
 providerId:text('provider_id').notNull().references(()=>passwordAccounts.providerId),
 expiresAt:integer('expires_at').notNull(),
},t=>[index('password_sessions_expiry').on(t.expiresAt)]);
export const authLimits=sqliteTable('auth_limits',{
 key:text('key').primaryKey().notNull(),
 attempts:integer('attempts').notNull(),
 expiresAt:integer('expires_at').notNull(),
},t=>[index('auth_limits_expiry').on(t.expiresAt)]);
