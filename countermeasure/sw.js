// Scope-relative paths also work at /countermeasure/ on GitHub Pages.
const ROOT=new URL('./',self.location.href),PREFIX=`countermeasure:${ROOT.pathname}:`,CACHE=PREFIX+'v11-install-2';
const FILES=['./','./index.html','./style.css','./game.mjs','./engine.mjs','./subjects.mjs','./saves.mjs','./music.mjs','./offline.mjs','./controls.mjs','./play-mode.mjs','./install.mjs','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./icons/maskable-512.png','./icons/apple-touch-icon.png'];
const urls=FILES.map(file=>new URL(file,ROOT).href);
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(urls))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith(PREFIX)&&key!==CACHE)await caches.delete(key);await self.clients.claim();})()));
self.addEventListener('message',event=>{if(event.data==='ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;const url=new URL(event.request.url);if(url.origin!==ROOT.origin||!url.pathname.startsWith(ROOT.pathname))return;const key=event.request.mode==='navigate'?new URL('./index.html',ROOT).href:url.href;if(!urls.includes(key))return;event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(key))??fetch(event.request)));});
