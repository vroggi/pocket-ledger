import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import { reduce, type State, type Command } from '../../../lib/finance';
import {openLedger,commitLedger} from '../../../lib/store';
export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'}});
async function context(){
 const user=await getChatGPTUser();if(!user)return null;
 // Binding is private; the owner-private Sites gateway strips/replaces identity headers.
 if(!env.DB)throw Error('Database unavailable.');
 const db=env.DB.withSession('first-primary');
 const row=await openLedger(db,user.userId);
 return {db,user,row};
}
export async function GET(){try{const c=await context();if(!c)return json({error:'Sign in to your owner account.'},401);if(!c.row)return json({error:'This ledger belongs to a different owner.'},403);return json({state:JSON.parse(c.row.payload),revision:c.row.revision,owner:c.user.displayName});}catch{return json({error:'Could not load your ledger. Please try again.'},503);}}
export async function POST(request:Request){
 if(request.headers.get('x-ledger-client')!=='1')return json({error:'Invalid request origin.'},403);
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'Cross-origin changes are not allowed.'},403);
 try{
 if(Number(request.headers.get('content-length')||0)>1700000)return json({error:'Backup is too large.'},413);
 const raw=await request.text();if(raw.length>1700000)return json({error:'Backup is too large.'},413);
 const {command,revision}=JSON.parse(raw) as {command:Command;revision:number};
 if(!command||typeof command.type!=='string'||!command.value||typeof command.value!=='object'||!Number.isInteger(revision))return json({error:'Invalid change request.'},400);
 const c=await context();if(!c)return json({error:'Sign in to your owner account.'},401);if(!c.row)return json({error:'Owner access required.'},403);
 const state:State=JSON.parse(c.row.payload);
 if(state.processed.includes(command.requestId))return json({state,revision:c.row.revision});
 if(revision!==c.row.revision)return json({error:'Your ledger changed on another device. Latest data has been loaded; review and save again.',state,revision:c.row.revision},409);
 let next:State;try{next=reduce(state,command);}catch(e){return json({error:e instanceof Error?e.message:'Invalid change.'},422);}
 const committed=await commitLedger(c.db,c.user.userId,revision,next);
 if(!committed)return json({error:'Another device saved at the same time. Refresh and try again.'},409);
 return json({state:next,revision:revision+1});
 }catch{return json({error:'Save was not confirmed. Check your connection and retry the same change.'},503);}
}
