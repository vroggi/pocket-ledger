'use client';
import {useEffect,useState} from 'react';
import {Share,PlusSquare,CheckCircle2,Smartphone} from 'lucide-react';
import {readDevice} from './device-cache';

export default function InstallGuide(){
 const [installed,setInstalled]=useState(false),[shell,setShell]=useState(false),[copy,setCopy]=useState(false),[checking,setChecking]=useState(true),[problem,setProblem]=useState('');
 async function check(){
  setChecking(true);setProblem('');
  try{
   setInstalled(window.matchMedia('(display-mode: standalone)').matches||!!(navigator as Navigator & {standalone?:boolean}).standalone);
   if('serviceWorker' in navigator)await navigator.serviceWorker.register('/sw.js');
   setShell('caches' in window&&!!(await caches.match('/offline/index.html')));
   setCopy(!!(await readDevice()));
  }catch{setProblem('Could not check offline storage. Open your ledger online and try again.');}
  finally{setChecking(false);}
 }
 useEffect(()=>{void check()},[]);
 return <div className="install-guide">
  <div className="install-identity"><img src="/icon-192.png" width="64" height="64" alt=""/><div><h3>Pocket Ledger</h3><p>Your money, on your iPhone.</p></div></div>
  {installed?<p className="install-success"><CheckCircle2 size={20}/>Already running as an app on this device.</p>:<><p>Install from Safari to get an app icon and a separate, full-screen window.</p><ol className="install-steps">
   <li><Smartphone aria-hidden="true"/><div><strong>Open in Safari</strong><p>If you opened this link inside another app, copy the link and paste it into Safari. Sign in with your ChatGPT account.</p></div></li>
   <li><Share aria-hidden="true"/><div><strong>Tap Share</strong><p>Look for the square with an upward arrow. It may be inside Safari’s More menu.</p></div></li>
   <li><PlusSquare aria-hidden="true"/><div><strong>Add to Home Screen</strong><p>Scroll down the share menu. Keep “Open as Web App” on if shown, then tap Add. If the action is missing, look under Edit Actions.</p></div></li>
   <li><CheckCircle2 aria-hidden="true"/><div><strong>Open the new icon</strong><p>Open Pocket Ledger from your Home Screen while online. Sign in again if asked and wait for Synced before using it offline.</p></div></li>
  </ol></>}
  <div className="install-readiness" role="status" aria-live="polite"><strong>Offline check · this browser</strong><p>{checking?'Checking…':`${shell?'✓':'○'} App files ${shell?'available':'not ready yet'} · ${copy?'✓ Ledger copy available':'○ Open your ledger to save a device copy'}`}</p>{problem&&<p>{problem}</p>}<button className="btn small" onClick={()=>void check()} disabled={checking}>Check again</button></div>
  <p className="muted">The installed app may use separate storage. Repeat the check there after opening your ledger online. Offline changes show Not synced until the server confirms them. Keep the app open after reconnecting.</p>
  <a className="btn primary" href="/">Open my ledger</a>
  <details><summary>Android or computer?</summary><p>Open in Chrome or Edge and choose Install app from the browser menu or address bar.</p></details>
 </div>;
}
