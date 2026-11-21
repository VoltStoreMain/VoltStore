/* VoltStore Beta offline shell: static pages only.
   Never intercept API/auth requests or cache Supabase, payments, user photos or user data. */
'use strict';
const VERSION='voltstore-shell-v1-20261122';
const CACHE_NAME='voltstore-static-'+VERSION;
const STATIC=[
 './market.html','./market.css','./market-core.js','./market.js',
 './mobile-shell.css','./mobile-shell.js','./photo-store.js','./pwa-client.js',
 './voltdeal.html','./voltdeal.css','./voltdeal-core.js','./voltdeal.js',
 './voltguide.html','./voltguide.css','./voltguide-core.js','./voltguide.js',
 './passport-core.js','./voltcheck-all.html','./voltcheck-all.css','./voltcheck-all.js',
 './voltpassport.html','./voltpassport.css','./passport-app.js',
 './offline.html','./manifest.webmanifest',
 './icons/voltstore-192.png','./icons/voltstore-512.png','./icons/voltstore-maskable-512.png'
];
const htmlPaths=new Set(['market.html','voltdeal.html','voltguide.html','voltcheck-all.html','voltpassport.html','offline.html']);
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(STATIC)));
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
   const keys=await caches.keys();
   await Promise.all(keys.filter(key=>key.startsWith('voltstore-static-')&&key!==CACHE_NAME)
    .map(key=>caches.delete(key)));
   await self.clients.claim();
 })());
});
self.addEventListener('message',event=>{
 if(event.data&&event.data.type==='SKIP_WAITING')self.skipWaiting();
});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET'||request.headers.has('authorization'))return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin)return;
 const scope=new URL(self.registration.scope);
 if(!url.pathname.startsWith(scope.pathname))return;
 const file=url.pathname.slice(scope.pathname.length);
 // Never cache auth/live commerce, config, Supabase, Netlify Functions or API URLs.
 if(file===''||file==='index.html'||file==='app.js'||file==='live.js'||file==='config.js'
    ||file.startsWith('.netlify/')||file.startsWith('api/')||file.startsWith('supabase/')
    ||file.startsWith('auth/')||file.includes('/')) {
   // Allow explicit icons under /icons/, and only those already in the static list.
   if(!STATIC.some(x=>x.slice(2)===file))return;
 }
 if(!STATIC.some(x=>x.slice(2)===file))return;
 const isPage=htmlPaths.has(file);
 event.respondWith((async()=>{
   const cache=await caches.open(CACHE_NAME);
   // Canonicalize all static cache keys to path ONLY. Never store search params
   // (which can contain ad IDs, model names or user choices) in Cache Storage.
   const canonical=new URL(file,scope).href;
   if(isPage){
     // Network-first for HTML: live content updates and query strings aren't stored.
     try{
       const live=await fetch(request);
       if(live.ok&&live.type==='basic')cache.put(canonical,live.clone()).catch(()=>{});
       return live;
     }catch(_){
       return (await cache.match(canonical)) ||
         (await cache.match('./offline.html')) || Response.error();
     }
   }
   // Versioned static-only cache. No stale user or API responses.
   const local=await cache.match(canonical);
   if(local)return local;
   return fetch(request);
 })());
});
