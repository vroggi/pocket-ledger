import {getChatGPTUser} from '../../../chatgpt-auth';
import {authDatabase,passwordConfig,passwordMode} from '../../../app-auth';
import {provider,credentials,issueSession,revokeSession,throttle,validOrigin,readAuthBody,readCookie,cookie,SESSION_COOKIE,RECOVERY_COOKIE,SESSION_AGE,type ProviderUser} from '../../../../lib/password-auth';
export const dynamic='force-dynamic';
const json=(body:unknown,status=200,cookies:string[]=[])=>{const headers=new Headers({'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'});for(const c of cookies)headers.append('Set-Cookie',c);return Response.json(body,{status,headers});};
export async function POST(request:Request,context:{params:Promise<{action:string}>}){
 if(!validOrigin(request))return json({error:'Cross-origin authentication is not allowed.'},403);
 const {action}=await context.params;
 try{
  const db=authDatabase();
  if(action==='logout'){await revokeSession(db,readCookie(request.headers.get('cookie'),SESSION_COOKIE));return json({redirect:passwordMode()?'/auth':'/signout-with-chatgpt?return_to=%2F'},200,[cookie(SESSION_COOKIE,'',0),cookie(RECOVERY_COOKIE,'',0)]);}
  const config=passwordConfig();if(!config||!passwordMode())return json({error:'Password sign-in is awaiting service setup. Existing access has been kept available.'},503);
  if(Number(request.headers.get('content-length')||0)>4096)return json({error:'Request is too large.'},413);
  const body=await readAuthBody(request);
  await throttle(db,'auth:'+ (request.headers.get('cf-connecting-ip')||'shared-gateway'));
  if(action==='recover'){const email=credentials({email:body.email,password:'validation-only'}).email;await provider(config,'recover',{email});return json({message:'If the address is registered, a password reset email will arrive shortly.'});}
  if(action==='password'){
   const token=decodeURIComponent(readCookie(request.headers.get('cookie'),RECOVERY_COOKIE));if(!token)return json({error:'Open a fresh password reset link from your email.'},401);
   const {password}=credentials({email:'recovery@example.test',password:body.password});
   const user:ProviderUser=await provider(config,'user',undefined,token);
   const result=await fetch(config.url.replace(/\/$/,'')+'/auth/v1/user',{method:'PUT',headers:{apikey:config.key,'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({password}),signal:AbortSignal.timeout(12000)});
   if(!result.ok)throw Error('Could not update your password. Request a new reset link.');
   await db.prepare('DELETE FROM password_sessions WHERE provider_id=?').bind(user.id).run();
   return json({message:'Password updated. Sign in with your new password.',redirect:'/auth?reset=1'},200,[cookie(RECOVERY_COOKIE,'',0),cookie(SESSION_COOKIE,'',0)]);
  }
  const {email,password}=credentials(body);
  if(action==='register'){await provider(config,'signup',{email,password});return json({message:'Check your email to confirm your account, then sign in. If you already have an account, sign in or reset your password.'});}
  if(action!=='login')return json({error:'Unknown authentication action.'},404);
  const result=await provider(config,'token?grant_type=password',{email,password});
  if(!result.access_token)throw Error('Sign-in was not confirmed.');
  // Independently verify the provider token before issuing a server session.
  const user:ProviderUser=await provider(config,'user',undefined,result.access_token);
  const legacy=body.linkExisting?await getChatGPTUser():null;if(body.linkExisting&&!legacy)return json({error:'Sign in to the existing ledger before connecting it.'},403);
  const session=await issueSession(db,user,legacy?.userId);
  return json({redirect:'/'},200,[cookie(SESSION_COOKIE,session.token,SESSION_AGE)]);
 }catch(e){return json({error:e instanceof Error?e.message:'Authentication failed. Please try again.'},400);}
}
export async function GET(request:Request,context:{params:Promise<{action:string}>}){
 const {action}=await context.params;if(action!=='confirm')return json({error:'Use POST for authentication changes.'},405);
 try{const config=passwordConfig();if(!config)throw Error('Authentication is not configured.');const url=new URL(request.url);const hash=url.searchParams.get('token_hash'),type=url.searchParams.get('type');if(!hash||hash.length>256||!['email','recovery'].includes(type||''))throw Error('Invalid confirmation link.');
 const result=await provider(config,'verify',{token_hash:hash,type});
 const headers=new Headers({'Location':new URL(type==='recovery'?'/auth?mode=reset':'/auth?confirmed=1',url.origin).href,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});
 if(type==='recovery'){if(!result.access_token)throw Error('Invalid reset link.');headers.append('Set-Cookie',cookie(RECOVERY_COOKIE,result.access_token,600));}
 return new Response(null,{status:303,headers});
 }catch{return new Response(null,{status:303,headers:{Location:'/auth?expired=1','Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});}
}
