import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {ledgerApi} from '../../../lib/ledger-api';
export const dynamic='force-dynamic';
const api=ledgerApi(getChatGPTUser,()=>{if(!env.DB)throw Error('Database unavailable.');return env.DB.withSession('first-primary');});
export const GET=api.GET;
export const POST=api.POST;
