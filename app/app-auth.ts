import {env} from 'cloudflare:workers';
import {cookies} from 'next/headers';
import {getChatGPTUser} from './chatgpt-auth';
import {sessionUser,SESSION_COOKIE,type PasswordConfig} from '../lib/password-auth';
export function passwordMode(){return (env as Cloudflare.Env & {AUTH_MODE?:string}).AUTH_MODE==='password';}
export function passwordConfig():PasswordConfig|null{const e=env as Cloudflare.Env & {SUPABASE_URL?:string;SUPABASE_PUBLISHABLE_KEY?:string};return e.SUPABASE_URL&&e.SUPABASE_PUBLISHABLE_KEY?{url:e.SUPABASE_URL,key:e.SUPABASE_PUBLISHABLE_KEY}:null;}
export function authDatabase(){if(!env.DB)throw Error('Database unavailable.');return env.DB.withSession('first-primary');}
export async function getAppUser(){if(!passwordMode())return getChatGPTUser();const token=(await cookies()).get(SESSION_COOKIE)?.value||'';return sessionUser(authDatabase(),token);}
