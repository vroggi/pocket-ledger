import InstallGuide from '../install-guide';
import {requireChatGPTUser} from '../chatgpt-auth';
export const dynamic='force-dynamic';
export default async function InstallPage(){await requireChatGPTUser('/install');return <main className="install-page"><a className="install-back" href="/">← Back to my ledger</a><section className="panel"><h1>Install on your iPhone</h1><InstallGuide/></section></main>}
