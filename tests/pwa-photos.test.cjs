'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(base,p),'utf8'),exists=p=>fs.existsSync(path.join(base,p));
const photo=require('../photo-store.js');
test('PWA manifest is valid, standalone, scoped to VoltStore, with search/sell/check shortcuts',()=>{
 const m=JSON.parse(read('manifest.webmanifest'));
 assert.equal(m.display,'standalone');
 assert.equal(m.start_url,'./market.html');
 assert.equal(m.scope,'./');
 assert.equal(m.lang,'ru');
 assert.equal(m.id,'./market.html');
 assert.ok(m.shortcuts.length>=3);
 assert.ok(m.icons.some(i=>i.sizes==='192x192'));
 assert.ok(m.icons.some(i=>i.sizes==='512x512'));
 assert.ok(m.icons.some(i=>i.purpose==='maskable'));
});
test('PWA icons exist as real PNG files, with valid signature and dimensions',()=>{
 const manifest=JSON.parse(read('manifest.webmanifest'));
 for(const icon of manifest.icons){
   const p=icon.src.replace(/^\.\//,'');
   assert.ok(exists(p),p);
   const b=fs.readFileSync(path.join(base,p));
   assert.deepEqual([...b.subarray(0,8)],[137,80,78,71,13,10,26,10],p);
   const width=b.readUInt32BE(16),height=b.readUInt32BE(20);
   const [expectW,expectH]=icon.sizes.split('x').map(Number);
   assert.equal(width,expectW);assert.equal(height,expectH);
 }
});
test('Every static service-worker precache path exists',()=>{
 const sw=read('sw.js');
 const match=sw.match(/const STATIC=\[([\s\S]*?)\];/);
 assert.ok(match,'static array not found');
 const files=[...match[1].matchAll(/'\.\/([^']+)'/g)].map(m=>m[1]);
 assert.ok(files.length>14);
 for(const f of files)assert.ok(exists(f),f);
});
test('Service worker never intercepts live shop, API, auth, payment or third party',()=>{
 const s=read('sw.js');
 assert.match(s,/url\.origin!==self\.location\.origin/);
 assert.match(s,/request\.method!=='GET'/);
 assert.ok(s.includes("request.headers.has('authorization')"));
 for(const item of ['config.js','live.js','app.js','index.html',".netlify/","api/","supabase/","auth/"])
   assert.ok(s.includes(item),item);
});
test('Service worker canonically caches static page only, never query string',()=>{
 const s=read('sw.js');
 assert.ok(s.includes("const canonical=new URL(file,scope).href"));
 assert.ok(s.includes('cache.put(canonical,live.clone())'));
 assert.ok(!s.includes('cache.put(request,'));
});
test('Service worker avoids importing third-party scripts and caching checkout responses',()=>{
 const s=read('sw.js'),manifest=read('manifest.webmanifest');
 assert.ok(!s.includes('https://cdn.'));
 assert.ok(!s.includes('openai.com'));
 assert.ok(!s.includes('caches.open(\'user'));
 assert.ok(!manifest.includes('http://'));
});
test('PWA client registers only on HTTPS/localhost with opt-in install prompt',()=>{
 const s=read('pwa-client.js');
 assert.match(s,/location\.protocol==='https:'|localhost/);
 assert.ok(s.includes("navigator.serviceWorker.register('./sw.js'"));
 assert.ok(s.includes('beforeinstallprompt'));
 assert.ok(s.includes('userChoice'));
 assert.ok(s.includes('Share')||s.includes('Поделиться'));
});
test('Main and five buyer pages have manifest, SW client; main has install UI',()=>{
 for(const file of ['index.html','market.html','voltdeal.html','voltguide.html','voltcheck-all.html','voltpassport.html']){
   const s=read(file);
   assert.ok(s.includes('href="manifest.webmanifest"')||s.includes('rel="manifest" href="manifest.webmanifest"'),file);
   assert.ok(s.includes('src="pwa-client.js"'),file);
 }
 assert.ok(read('index.html').includes('id="pwaInstall"'));
 assert.ok(read('market.html').includes('id="pwaInstall"'));
});
test('Local photos accept common images and reject other upload formats',()=>{
 for(const mime of ['image/jpeg','image/png','image/webp','image/heic'])
   assert.equal(photo.validateFile({type:mime,size:120000}),true);
 assert.throws(()=>photo.validateFile({type:'text/html',size:120000}),/JPG/);
 assert.throws(()=>photo.validateFile({type:'image/svg+xml',size:120000}),/JPG/);
});
test('Local photo source size and draft IDs are strictly limited',()=>{
 assert.throws(()=>photo.validateFile({type:'image/jpeg',size:photo.MAX_SOURCE+1}),/12 МБ/);
 assert.throws(()=>photo.validateFile({type:'image/jpeg',size:0}),/12 МБ/);
 assert.equal(photo.validId('draft-sample_123'),true);
 assert.equal(photo.validId('demo-phone-1'),false);
 assert.equal(photo.validId('draft-../hack'),false);
 assert.equal(photo.LIMIT,4);
 assert.ok(photo.MAX_OUTPUT<=1024*1024);
});
test('Photo store uses IndexedDB and rasterized JPEG output to strip metadata',()=>{
 const js=read('photo-store.js');
 assert.ok(js.includes("indexedDB.open(DB,1)"));
 assert.ok(js.includes("canvas.toBlob("));
 assert.ok(js.includes("'image/jpeg'"));
 assert.ok(!js.includes('localStorage.setItem'));
 assert.ok(!/fetch\s*\(/.test(js));
});
test('Seller form offers camera-photo selection with honest local-only notice',()=>{
 const html=read('market.html'),js=read('market.js');
 assert.ok(html.includes('id="formPhotos"'));
 assert.ok(html.includes('id="photoPreview"'));
 assert.ok(html.includes('id="editDraftPhotos"')||js.includes('id="editDraftPhotos"'));
 assert.ok(html.includes('не загружаются на сайт'));
 assert.ok(js.includes('photos.save(normalized.id,files)'));
 assert.ok(js.includes('photos.remove(id)'));
});
test('Photos are lazily hydrated and object URLs are explicitly released',()=>{
 const js=read('market.js');
 assert.ok(js.includes('IntersectionObserver'));
 assert.ok(js.includes("loading='lazy'"));
 assert.ok(js.includes('URL.revokeObjectURL(url)'));
 assert.ok(js.includes('hydrateCovers(items)'));
 assert.ok(js.includes('hydrateGallery(item)'));
});

test('VoltGuide offline free advice loads without third-party Supabase SDK',()=>{
 const html=read('voltguide.html'),js=read('voltguide.js');
 assert.ok(!html.includes('src="https://cdn.jsdelivr.net/npm/@supabase/'));
 assert.ok(js.includes('ensureAuthLibrary'));
 assert.ok(js.includes("await ensureAuthLibrary()"));
 assert.ok(js.includes("document.head.appendChild(script)"));
});

test('Safari/WebKit-compatible photo persistence uses ArrayBuffer, with legacy Blob reader',()=>{
 const js=read('photo-store.js');
 assert.ok(js.includes('await blob.arrayBuffer()'));
 assert.ok(js.includes('data,mime:'));
 assert.ok(js.includes('function rowToBlob(row)'));
 assert.ok(js.includes('row.blob instanceof Blob'));
 assert.ok(js.includes("new Blob([data],{type:'image/jpeg'})"));
});
