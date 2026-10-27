// Private financial responses are deliberately never cached.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
 if(event.request.mode==='navigate')event.respondWith(fetch(event.request).catch(()=>new Response('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><title>Pocket Ledger · Offline</title><body style="font:18px system-ui;max-width:480px;margin:18vh auto;padding:24px;color:#143e36"><h1>You’re offline</h1><p>Pocket Ledger needs an internet connection to load and save your finances. No changes have been saved.</p><button onclick="location.reload()" style="padding:14px 24px;font:inherit">Try again</button></body></html>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}})));
});
