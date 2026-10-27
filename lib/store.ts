import { initialState, type State } from './finance.ts';
export interface LedgerDatabase { prepare(sql:string): { bind(...values:unknown[]): {run():Promise<{meta:{changes?:number}}>;first<T>():Promise<T|null>} } }
export type Row={owner:string;revision:number;payload:string};
export async function openLedger(db:LedgerDatabase,owner:string):Promise<Row|null>{
 await db.prepare('INSERT INTO ledger (id, owner, revision, payload, updated_at) VALUES (1, ?, 0, ?, ?) ON CONFLICT(id) DO NOTHING').bind(owner,JSON.stringify(initialState()),new Date().toISOString()).run();
 return db.prepare('SELECT owner, revision, payload FROM ledger WHERE id=1 AND owner=?').bind(owner).first<Row>();
}
export async function commitLedger(db:LedgerDatabase,owner:string,revision:number,state:State):Promise<boolean>{
 const result=await db.prepare('UPDATE ledger SET payload=?, revision=revision+1, updated_at=? WHERE id=1 AND owner=? AND revision=?').bind(JSON.stringify(state),new Date().toISOString(),owner,revision).run();return (result.meta.changes||0)===1;
}
