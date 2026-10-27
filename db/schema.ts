import { sqliteTable, integer, text, check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
export const ledger = sqliteTable('ledger', {
 id: integer('id').primaryKey(),
 owner: text('owner').notNull(),
 revision: integer('revision').notNull().default(0),
 payload: text('payload').notNull(),
 updatedAt: text('updated_at').notNull(),
}, t => [check('singleton',sql`${t.id} = 1`),check('valid_payload',sql`json_valid(${t.payload})`),check('positive_revision',sql`${t.revision} >= 0`)]);
