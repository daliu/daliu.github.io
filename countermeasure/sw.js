// Migration-only worker. Never precaches or serves the former game runtime.
const ROOT=new URL('./',self.location.href),PREFIX=`countermeasure:${ROOT.pathname}:`;
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const key of await caches.keys())if(key.startsWith(PREFIX))await caches.delete(key);
  await self.clients.claim();
  const clients=await self.clients.matchAll({type:'window'});
  await self.registration.unregister();
  const destination=new URL('./?portal=1',ROOT).href;
  await Promise.allSettled(clients.filter(client=>{const url=new URL(client.url);return url.origin===ROOT.origin&&url.pathname.startsWith(ROOT.pathname)&&url.searchParams.get('portal')!=='1';}).map(client=>client.navigate(destination)));
})()));
self.addEventListener('message',event=>{if(event.data==='ACTIVATE_UPDATE')self.skipWaiting();});
