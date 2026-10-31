import {env} from 'cloudflare:workers';
import {getAppUser} from '../../app-auth';
import {ledgerApi} from '../../../lib/ledger-api';
export const dynamic='force-dynamic';
const api=ledgerApi(getAppUser,()=>{if(!env.DB)throw Error('Database unavailable.');return env.DB.withSession('first-primary');});
export const GET=api.GET;
export const POST=api.POST;
