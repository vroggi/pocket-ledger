import {reduce,type State,type Command} from './finance.ts';
import {openLedger,commitLedger,isLegacyOwner,type LedgerDatabase} from './store.ts';
type Identity={userId:string;displayName:string};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'}});
// Dependencies are server-only. No request field can select the database owner.
export function ledgerApi(getIdentity:()=>Promise<Identity|null>,getDatabase:()=>LedgerDatabase){
 async function context(){const user=await getIdentity();if(!user)return null;const db=getDatabase();return {db,user};}
 return {
 async GET(){try{const c=await context();if(!c)return json({error:'Sign in to open your ledger.'},401);const row=await openLedger(c.db,c.user.userId);return json({state:JSON.parse(row.payload),revision:row.revision,owner:c.user.displayName,accountId:c.user.userId,legacyOwner:await isLegacyOwner(c.db,c.user.userId)});}catch{return json({error:'Could not load your ledger. Please try again.'},503);}},
 async POST(request:Request){
  if(request.headers.get('x-ledger-client')!=='1')return json({error:'Invalid request origin.'},403);
  const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'Cross-origin changes are not allowed.'},403);
  try{
   const c=await context();if(!c)return json({error:'Sign in to save your ledger.'},401);
   if(Number(request.headers.get('content-length')||0)>1700000)return json({error:'Backup is too large.'},413);
   const raw=await request.text();if(raw.length>1700000)return json({error:'Backup is too large.'},413);
   const {command,revision,accountId}=JSON.parse(raw) as {command:Command;revision:number;accountId:string};
   // Old clients have an unscoped queue and must upgrade before saving.
   if(accountId!==c.user.userId)return json({error:'Your signed-in account changed. Reopen the app before syncing.',code:'account_changed'},403);
   if(!command||typeof command.type!=='string'||!command.value||typeof command.value!=='object'||!Number.isInteger(revision))return json({error:'Invalid change request.'},400);
   const row=await openLedger(c.db,c.user.userId);const state:State=JSON.parse(row.payload);
   if(state.processed.includes(command.requestId))return json({state,revision:row.revision,accountId:c.user.userId});
   if(revision!==row.revision)return json({error:'Your ledger changed on another device. Review and save again.',state,revision:row.revision,accountId:c.user.userId},409);
   let next:State;try{next=reduce(state,command);}catch(e){return json({error:e instanceof Error?e.message:'Invalid change.'},422);}
   if(!await commitLedger(c.db,c.user.userId,revision,next))return json({error:'Another device saved at the same time. Refresh and try again.'},409);
   return json({state:next,revision:revision+1,accountId:c.user.userId});
  }catch{return json({error:'Save was not confirmed. Check your connection and retry.'},503);}
 }
 };
}
