import {reduce,monthOf,today,type State,type Command} from './finance.ts';
export type QueuedChange={command:Command;baseline:string;revision:number;createdAt:string};
export type ConflictDraft=QueuedChange&{reason:string};
export type DeviceLedger={server:State;revision:number;outbox:QueuedChange[];drafts:ConflictDraft[];lastSynced:string;ownerName?:string};
export function fingerprint(s:State,c:Command):string{
 const v=c.value;const type=c.type;
 const collection=type==='account'||type==='archiveAccount'?s.accounts:type==='goal'||type==='confirmFixed'?s.goals:type==='category'?s.categories:type==='transaction'||type==='deleteTransaction'?s.transactions:type==='budget'||type==='deleteBudget'?s.budgets:type==='recurring'||type==='confirmRecurring'||type==='skipRecurring'?s.recurring:null;
 if(type==='restore')return 'revision';
 return collection?JSON.stringify(collection.find(x=>x.id===(type==='confirmFixed'?v.goalId:v.id))??null):'relative';
}
export function occurrenceDone(s:State,c:Command){return (c.type==='confirmRecurring'||c.type==='skipRecurring')&&s.occurrences.some(o=>o.key===c.value.id+':'+c.value.date)||(c.type==='confirmFixed'&&s.fixedConfirmations.includes(c.value.goalId+':'+c.value.month));}
export function rebase(local:DeviceLedger,server:State,revision:number,now=today()){
 let view=server;const outbox:QueuedChange[]=[],drafts=[...local.drafts];
 for(const q of local.outbox){
  if(server.processed.includes(q.command.requestId)||occurrenceDone(server,q.command))continue;
  let reason='';
  if(q.command.type==='restore'&&q.revision!==revision)reason='The cloud ledger changed after this restore was prepared.';
  else if(q.baseline!==fingerprint(view,q.command)&&q.baseline!=='relative'&&q.baseline!=='revision')reason='This record changed on another device. The cloud version was kept.';
  try{if(!reason){view=reduce(view,q.command,now);outbox.push(q);continue;}}catch(e){reason=e instanceof Error?e.message:'This change needs review.';}
  drafts.push({...q,reason});
 }
 return {view,cache:{...local,server,revision,outbox,drafts}};
}
export function prepareChange(cache:DeviceLedger,command:Command,view:State,now=today()):QueuedChange{
 const value={...command.value};const captured=value.__baseline;delete value.__baseline;
 if(command.type==='allocate'||command.type==='release')value.date=now;
 if(command.type==='confirmFixed')value.month=monthOf(now);
 const clean={...command,value};reduce(view,clean,now);
 return {command:clean,baseline:typeof captured==='string'?captured:fingerprint(view,clean),revision:cache.revision,createdAt:new Date().toISOString()};
}
export async function encryptDeviceData(value:unknown,key:CryptoKey){const iv=crypto.getRandomValues(new Uint8Array(12));const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify(value)));return {iv,ciphertext};}
export async function decryptDeviceData(encrypted:{iv:Uint8Array;ciphertext:ArrayBuffer},key:CryptoKey){const clear=await crypto.subtle.decrypt({name:'AES-GCM',iv:encrypted.iv as BufferSource},key,encrypted.ciphertext);return JSON.parse(new TextDecoder().decode(clear));}
