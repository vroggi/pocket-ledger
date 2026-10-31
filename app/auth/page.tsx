import AuthForm from './auth-form';
import {getChatGPTUser} from '../chatgpt-auth';
import {passwordConfig,passwordMode} from '../app-auth';
export const dynamic='force-dynamic';
export default async function AuthPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){const p=await searchParams;const mode=['register','recover','reset'].includes(p.mode||'')?p.mode as 'register'|'recover'|'reset':'login';return <AuthForm configured={passwordMode()&&!!passwordConfig()} canLink={!!await getChatGPTUser()} initialMode={mode} message={p.confirmed?'Email confirmed. Sign in to continue.':p.reset?'Password updated. Sign in with your new password.':p.expired?'That link expired or was already used. Request another email.':''}/>}
