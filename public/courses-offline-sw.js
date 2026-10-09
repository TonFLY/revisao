const CACHE='sql-courses-offline-v1';
const ASSETS=['/courses.html','/courses/style.css','/courses/base.js','/courses/app.js','/courses/sync.js','/courses/offline.js','/courses/catalog.json'];
self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('message',e=>{if(e.data?.type!=='prepare-courses')return;e.waitUntil((async()=>{try{const responses=await Promise.all(ASSETS.map(async path=>{const r=await fetch(path,{cache:'reload'});if(!r.ok)throw Error();return [path,r]}));const cache=await caches.open(CACHE);await Promise.all(responses.map(([p,r])=>cache.put(p,r)));e.ports[0]?.postMessage({ok:true})}catch{e.ports[0]?.postMessage({ok:false})}})())});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin||!ASSETS.includes(u.pathname)||e.request.headers.has('range'))return;e.respondWith((async()=>{try{return await fetch(e.request)}catch{const cached=await caches.match(u.pathname,{cacheName:CACHE});return cached||Response.error()}})())});
