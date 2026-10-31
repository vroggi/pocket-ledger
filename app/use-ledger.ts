'use client';
import {useState,useRef,useEffect,useCallback} from 'react';
import {demoState} from '../lib/demo';
import {reduce,type State,type Command} from '../lib/finance';
import {rebase,prepareChange,fingerprint,type DeviceLedger,type QueuedChange} from '../lib/sync';
import {readDevice,writeDevice,activeAccount,setActiveAccount,readLegacyDevice,eraseLegacyDevice,clearDevice as eraseDevice} from './device-cache';
const liveRequests=new Set<AbortController>();
async function network(path:string,init:RequestInit={}){const abort=new AbortController();liveRequests.add(abort);const timer=setTimeout(()=>abort.abort(),12000);try{return await fetch(path,{...init,signal:abort.signal,cache:'no-store'})}finally{clearTimeout(timer);liveRequests.delete(abort)}}
export function useLedger(demo:boolean,expectedAccount?:string){
 const [data,setData]=useState<State|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[offline,setOffline]=useState(false),[notice,setNotice]=useState(''),[synced,setSynced]=useState(''),[queueCount,setQueueCount]=useState(0),[drafts,setDrafts]=useState<DeviceLedger['drafts']>([]),[authRequired,setAuthRequired]=useState(false),[ownerName,setOwnerName]=useState('');
 const account=useRef(expectedAccount||'');
 const local=useRef<DeviceLedger|null>(null),view=useRef<State|null>(null),storageVersion=useRef(0),running=useRef(false);
 const publish=useCallback((cache:DeviceLedger)=>{const rebased=rebase(cache,cache.server,cache.revision);local.current=rebased.cache;view.current=rebased.view;setData(rebased.view);setOwnerName(cache.ownerName||'');setQueueCount(rebased.cache.outbox.length);setDrafts(rebased.cache.drafts);setSynced(cache.lastSynced?new Date(cache.lastSynced).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}):'');return rebased.cache},[]);
 async function persist(cache:DeviceLedger){const normalized=rebase(cache,cache.server,cache.revision).cache;storageVersion.current=await writeDevice(normalized,storageVersion.current,account.current);publish(normalized);return normalized}
 async function refreshLocal(){if(!account.current)return null;const saved=await readDevice(account.current);if(saved){storageVersion.current=saved.version;local.current=saved.value;}return local.current}
 async function exclusive<T>(action:()=>Promise<T>):Promise<T>{if(navigator.locks)return navigator.locks.request('pocket-ledger-sync',action);return action()}
 const load=useCallback(async()=>{
 if(demo){if(!view.current){view.current=demoState();setData(view.current)}return;}
 if(running.current)return;running.current=true;
 try{await exclusive(async()=>{
 let cache:DeviceLedger|null=null;
 if(!navigator.onLine){account.current ||= await activeAccount()||'';cache=await refreshLocal();setOffline(true);if(cache)publish(cache);else setError('Connect once and sign in before using this device offline.');return;}
 let response:Response;try{response=await network('/api/ledger')}catch{account.current ||= await activeAccount()||'';cache=await refreshLocal();setOffline(true);if(cache)publish(cache);else setError('No connection and no offline copy. Connect once to open your ledger.');return;}
 if(response.status===401||response.status===403){setAuthRequired(true);setData(null);setError('Sign in with your account to sync your ledger. Offline changes are kept on this device.');return;}
 if(!response.headers.get('content-type')?.includes('application/json')){setAuthRequired(true);setData(null);setError('Sign in with your account to sync. Local changes are kept.');return;}
 if(!response.ok){account.current ||= await activeAccount()||'';cache=await refreshLocal();setOffline(true);if(cache)publish(cache);setError('The server is unavailable. Changes can be queued on this device.');return;}
 const payload:any=await response.json();
 if(!payload.accountId||account.current&&account.current!==payload.accountId){setAuthRequired(true);setData(null);setError('The signed-in account changed. Reopen the app to load that account. Your previous offline changes are kept separately.');return;}
 account.current=payload.accountId;await setActiveAccount(account.current);setAuthRequired(false);setOffline(false);setError('');
 try{cache=await refreshLocal();if(!cache&&payload.legacyOwner){const legacy=await readLegacyDevice();if(legacy){storageVersion.current=0;cache=await persist(legacy.value);await eraseLegacyDevice();}}}catch{setError('Offline storage is unavailable. Check device storage before adding changes.');}
 
 cache=rebase(cache??{server:payload.state,revision:payload.revision,outbox:[],drafts:[],lastSynced:''},payload.state,payload.revision).cache;cache.lastSynced=new Date().toISOString();cache.ownerName=payload.owner;
 try{cache=await persist(cache)}catch{publish(cache);setError('Could not update the offline copy. Check device storage before adding changes.');}
 while(cache.outbox.length){
  const q:QueuedChange=cache.outbox[0];let result:Response;
  try{result=await network('/api/ledger',{method:'POST',headers:{'Content-Type':'application/json','x-ledger-client':'1'},body:JSON.stringify({command:q.command,revision:cache.revision,accountId:account.current})})}catch{setOffline(true);break;}
  if(result.status>=500){setOffline(true);setError('Sync not confirmed. The queued change will retry with the same ID.');break;}
  if(!result.headers.get('content-type')?.includes('application/json')){setAuthRequired(true);setError('Sign in again to sync. Your queued changes are kept.');break;}
  const p:any=await result.json();
  if(result.status===401||result.status===403){setAuthRequired(true);setData(null);setError('Sign in again to sync. Your queued changes are kept.');break;}
  if(p.accountId&&p.accountId!==account.current)throw Error('The account changed. Reopen the app.');
  if(result.status===409){if(p.state){cache=rebase(cache,p.state,p.revision).cache;cache=await persist(cache);}else break;continue;}
  if(!result.ok){cache={...cache,outbox:cache.outbox.slice(1),drafts:[...cache.drafts,{...q,reason:p.error||'This change needs review.'}]};cache=await persist(cache);continue;}
  cache=rebase({...cache,outbox:cache.outbox.slice(1)},p.state,p.revision).cache;cache.lastSynced=new Date().toISOString();cache=await persist(cache);setNotice(cache.outbox.length?'Syncing queued changes…':'Saved to your private database.');
 }
 });}catch(e){setError(e instanceof Error?e.message:'Could not sync. Your queued changes are kept.');}finally{running.current=false;}
 },[demo,publish]);
 useEffect(()=>{load();const timer=setInterval(()=>{if(document.visibilityState==='visible')load()},8000);const focus=()=>load(),off=()=>{setOffline(true);liveRequests.forEach(c=>c.abort())};window.addEventListener('online',focus);window.addEventListener('focus',focus);window.addEventListener('offline',off);const visibility=()=>{if(document.visibilityState==='visible')load()};document.addEventListener('visibilitychange',visibility);return()=>{clearInterval(timer);window.removeEventListener('online',focus);window.removeEventListener('focus',focus);window.removeEventListener('offline',off);document.removeEventListener('visibilitychange',visibility)}},[load]);
 useEffect(()=>{if(notice){const t=setTimeout(()=>setNotice(''),5000);return()=>clearTimeout(t)}},[notice]);
 async function submit(command:Command){
 if(busy||running.current)throw Error('Sync is in progress. Please try again in a moment.');
 if(demo){view.current=reduce(view.current!,command);setData(view.current);setNotice('Demo only · changes are not saved to a database.');return;}
 if(authRequired)throw Error('Sign in before making changes.');
 setBusy(true);running.current=true;
 try{await exclusive(async()=>{const c=await refreshLocal();if(!c)throw Error('Open the ledger online once before adding changes.');const current=rebase(c,c.server,c.revision);if(command.type==='restore'&&(!navigator.onLine||offline||current.cache.outbox.length))throw Error('Connect and finish syncing before restoring a backup.');const q=prepareChange(current.cache,command,current.view);await persist({...current.cache,outbox:[...current.cache.outbox,q]});setNotice('Queued on this device · not synced yet.');});}finally{running.current=false;setBusy(false)}
 void load();
 }
 async function discardDraft(requestId:string){if(running.current)return;await exclusive(async()=>{const c=await refreshLocal();if(c)await persist({...c,drafts:c.drafts.filter(d=>d.command.requestId!==requestId)})})}
 async function reapplyDraft(requestId:string){if(running.current)return;running.current=true;try{await exclusive(async()=>{const c=await refreshLocal();const d=c?.drafts.find(d=>d.command.requestId===requestId);if(!c||!d)return;const current=rebase(c,c.server,c.revision);const q=prepareChange(current.cache,{...d.command,value:{...d.command.value,__baseline:fingerprint(current.view,d.command)}},current.view);await persist({...current.cache,drafts:current.cache.drafts.filter(d=>d.command.requestId!==requestId),outbox:[...current.cache.outbox,q]});})}catch(e){setError((e as Error).message)}finally{running.current=false}void load()}
 async function clearDevice(){if(queueCount||drafts.length)throw Error('Sync or export and resolve queued changes before clearing this device.');await exclusive(()=>eraseDevice(account.current));local.current=null;storageVersion.current=0;}
 return {data,ownerName,busy,error,setError,offline,notice,setNotice,synced,queueCount,drafts,authRequired,load,submit,discardDraft,reapplyDraft,clearDevice};
}
