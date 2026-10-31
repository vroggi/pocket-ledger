import {spawnSync} from 'node:child_process';
import {readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const result=spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build','--config','offline/vite.config.ts'],{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);
const assets=['/offline/index.html',...readdirSync('public/offline/assets').map(x=>'/offline/assets/'+x),'/icon.svg','/icon-192.png','/icon-512.png','/manifest.webmanifest'];
const version=createHash('sha256').update(assets.map(p=>readFileSync('public'+p)).reduce((a,b)=>Buffer.concat([a,b]),Buffer.alloc(0))).digest('hex').slice(0,16);
writeFileSync('public/offline/assets.json',JSON.stringify({version,assets}));

writeFileSync('public/offline/version.js',`self.POCKET_BUILD_VERSION=${JSON.stringify(version)};\n`);
