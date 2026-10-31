import { initialState, type State } from './finance.ts';
export interface LedgerDatabase { prepare(sql:string): { bind(...values:unknown[]): {run():Promise<{meta:{changes?:number}}>;first<T>():Promise<T|null>} } }
export type Row={owner:string;revision:number;payload:string};
function identity(owner:string){if(!owner||owner.length>512)throw Error('Authenticated identity required.');}
export async function isLegacyOwner(db:LedgerDatabase,owner:string){identity(owner);return !!(await db.prepare('SELECT owner FROM ledger WHERE id=1 AND owner=?').bind(owner).first());}
export async function openLedger(db:LedgerDatabase,owner:string):Promise<Row>{
 identity(owner);
 const existing=await db.prepare('SELECT owner, revision, payload FROM user_ledgers WHERE owner=?').bind(owner).first<Row>();
 if(existing)return existing;
 // Never assign the original owner's ledger to a new user.
 const legacy=await db.prepare('SELECT owner, revision, payload FROM ledger WHERE id=1 AND owner=?').bind(owner).first<Row>();
 await db.prepare('INSERT INTO user_ledgers (owner, revision, payload, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(owner) DO NOTHING').bind(owner,legacy?.revision??0,legacy?.payload??JSON.stringify(initialState()),new Date().toISOString()).run();
 const row=await db.prepare('SELECT owner, revision, payload FROM user_ledgers WHERE owner=?').bind(owner).first<Row>();
 if(!row)throw Error('Ledger unavailable.');return row;
}
export async function commitLedger(db:LedgerDatabase,owner:string,revision:number,state:State):Promise<boolean>{
 identity(owner);
 const result=await db.prepare('UPDATE user_ledgers SET payload=?, revision=revision+1, updated_at=? WHERE owner=? AND revision=?').bind(JSON.stringify(state),new Date().toISOString(),owner,revision).run();return (result.meta.changes||0)===1;
}
