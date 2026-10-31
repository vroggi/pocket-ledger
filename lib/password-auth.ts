import type {LedgerDatabase} from './store.ts';
export type PasswordConfig={url:string;key:string};
export type ProviderUser={id:string;email:string;email_confirmed_at?:string};
export type PasswordUser={userId:string;displayName:string;email:string;providerId:string};
export const SESSION_COOKIE='__Host-pocket-session';
export const RECOVERY_COOKIE='__Host-pocket-recovery';
export const SESSION_AGE=7*24*60*60;
export async function digest(value:string){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');}
function randomToken(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');}
export function cookie(name:string,value:string,age:number){return `${name}=${encodeURIComponent(value)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${age}`;}
export function readCookie(header:string|null,name:string){return header?.split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1)||'';}
export function validOrigin(request:Request){return request.headers.get('origin')===new URL(request.url).origin&&request.headers.get('x-ledger-client')==='1';}
export async function readAuthBody(request:Request){
 const reader=request.body?.getReader();if(!reader)throw Error('Empty authentication request.');
 const decoder=new TextDecoder();let text='',bytes=0;
 try{while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>4096){await reader.cancel();throw Error('Authentication request is too large.');}text+=decoder.decode(part.value,{stream:true});}text+=decoder.decode();return JSON.parse(text);}finally{reader.releaseLock();}
}
export async function provider(config:PasswordConfig,path:string,body?:unknown,token?:string,fetcher:typeof fetch=fetch){
 const url=new URL(config.url);if(url.protocol!=='https:'||!url.hostname.endsWith('.supabase.co')||url.pathname!=='/')throw Error('Invalid authentication configuration.');
 const result=await fetcher(url.origin+'/auth/v1/'+path,{method:body===undefined?'GET':'POST',headers:{apikey:config.key,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(12000)});
 const data:any=await result.json().catch(()=>({}));
 if(!result.ok){if(result.status===429)throw Error('Too many attempts. Please wait and try again.');throw Error(path.startsWith('token')?'Email or password is incorrect, or email is not confirmed.':'Authentication request failed. Check your details or try again later.');}
 return data;
}
export function credentials(value:any){const email=typeof value.email==='string'?value.email.trim().toLowerCase():'';const password=typeof value.password==='string'?value.password:'';if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)throw Error('Enter a valid email address.');if(password.length<8||password.length>128)throw Error('Use a password between 8 and 128 characters.');return {email,password};}
export async function accountFor(db:LedgerDatabase,user:ProviderUser,linkOwner?:string){
 if(!user.id||!user.email_confirmed_at)throw Error('Confirm your email before signing in.');
 const found=await db.prepare('SELECT owner FROM password_accounts WHERE provider_id=?').bind(user.id).first<{owner:string}>();
 if(found){if(linkOwner&&found.owner!==linkOwner)throw Error('This email is already connected to a different ledger.');return found.owner;}
 const owner=linkOwner||'password:'+user.id;
 const linked=await db.prepare('SELECT provider_id FROM password_accounts WHERE owner=?').bind(owner).first();if(linked)throw Error('This ledger already has password sign-in. Use the connected email.');
 await db.prepare('INSERT INTO password_accounts (provider_id,owner,email) VALUES (?,?,?) ON CONFLICT(provider_id) DO NOTHING').bind(user.id,owner,user.email).run();
 const row=await db.prepare('SELECT owner FROM password_accounts WHERE provider_id=?').bind(user.id).first<{owner:string}>();
 if(!row||row.owner!==owner)throw Error('Account connection changed. Please retry.');return owner;
}
export async function issueSession(db:LedgerDatabase,user:ProviderUser,linkOwner?:string,now=Date.now()){
 const owner=await accountFor(db,user,linkOwner),token=randomToken();
 await db.prepare('DELETE FROM password_sessions WHERE token_hash IN (SELECT token_hash FROM password_sessions WHERE expires_at<? LIMIT 100)').bind(now).run();
 await db.prepare('INSERT INTO password_sessions (token_hash,provider_id,expires_at) VALUES (?,?,?)').bind(await digest(token),user.id,now+SESSION_AGE*1000).run();return {owner,token};
}
export async function sessionUser(db:LedgerDatabase,token:string,now=Date.now()):Promise<PasswordUser|null>{
 if(!/^[a-f0-9]{64}$/.test(token))return null;
 const row=await db.prepare('SELECT a.owner, a.email, a.provider_id FROM password_sessions s JOIN password_accounts a ON a.provider_id=s.provider_id WHERE s.token_hash=? AND s.expires_at>?').bind(await digest(token),now).first<{owner:string;email:string;provider_id:string}>();
 return row?{userId:row.owner,displayName:row.email.split('@')[0],email:row.email,providerId:row.provider_id}:null;
}
export async function revokeSession(db:LedgerDatabase,token:string){if(token)await db.prepare('DELETE FROM password_sessions WHERE token_hash=?').bind(await digest(token)).run();}
export async function throttle(db:LedgerDatabase,scope:string,now=Date.now()){
 const key=await digest(scope),until=now+5*60*1000;
 await db.prepare('DELETE FROM auth_limits WHERE key IN (SELECT key FROM auth_limits WHERE expires_at<? LIMIT 100)').bind(now-60*60*1000).run();
 const row=await db.prepare('INSERT INTO auth_limits (key,attempts,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN expires_at<=? THEN 1 ELSE attempts+1 END, expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END RETURNING attempts').bind(key,until,now,now).first<{attempts:number}>();
 if(!row||row.attempts>15)throw Error('Too many attempts. Wait five minutes and try again.');
}
