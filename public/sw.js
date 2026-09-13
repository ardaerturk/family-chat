const CACHE='chatgpt-shell-v3';
const SAFE=['/offline.html','/chatgpt-192.png','/chatgpt-512.png','/manifest.webmanifest'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SAFE)));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
// Never cache the app document, private API responses, messages, or uploaded files.
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(url.origin!==self.location.origin||event.request.method!=='GET')return;if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.match('/offline.html')));}else if(SAFE.includes(url.pathname)){event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));}});
