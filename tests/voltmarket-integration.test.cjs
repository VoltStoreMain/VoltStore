'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('VoltMarket page contains every DOM selector referenced by app',()=>{
 const html=read('market.html'),js=read('market.js');
 const selectors=[...js.matchAll(/\$\('([A-Za-z0-9_-]+)'\)/g)].map(m=>m[1]);
 const missing=[...new Set(selectors)].filter(id=>!html.includes('id="'+id+'"'));
 assert.deepEqual(missing,[]);
});
test('VoltMarket local scripts and styles all exist',()=>{
 const html=read('market.html'),files=[...html.matchAll(/(?:src|href)="([a-zA-Z0-9-]+\.(?:css|js))"/g)].map(x=>x[1]);
 assert.ok(files.includes('market-core.js'));
 assert.ok(files.includes('passport-core.js'));
 for(const file of files)assert.ok(fs.existsSync(path.join(root,file)),file);
});
test('Marketplace exposes no public payment or backend write path',()=>{
 const js=read('market.js');
 assert.ok(js.includes('localStorage'));
 assert.ok(js.includes('Черновик сохранён'));
 assert.ok(!js.includes('.from('));
 assert.ok(!js.includes('fetch('));
 assert.ok(!js.includes('service_role'));
 assert.match(read('market.html'),/не публикует объявление|черновики видны только/i);
});
test('Marketplace clearly labels examples and separate passport experience',()=>{
 const js=read('market.js');
 assert.match(js,/ДЕМО-ПРИМЕР/);
 assert.match(js,/Паспорт состояния|СВЕДЕНИЯ О СОСТОЯНИИ/);
 assert.match(js,/не является гарантией|не сертифицировано|Не сертифицировано/i);
 assert.ok(js.includes("core.link(item,'guide')"));
 assert.ok(js.includes("core.link(item,'check')"));
});
test('Marketplace entered intentionally from homepage',()=>{
 const index=read('index.html');
 assert.ok(index.includes('href="market.html"'));
 assert.match(index,/примеры не являются реальными предложениями/i);
});
test('VoltPassport linked demo uses exact listing, no unrelated sample',()=>{
 const js=read('passport-app.js'),html=read('voltpassport.html');
 assert.ok(js.includes('linkedMarketListing'));
 assert.ok(js.includes('passport=item?'));
 assert.ok(html.includes('src="market-core.js"'));
 assert.ok(js.includes("$('categoryChooser').hidden=!!item"));
 assert.ok(js.includes('voltcheck-universal-v1'));
});
test('Legacy smartphone resale and original VoltCheck remain',()=>{
 assert.ok(read('index.html').includes('href="#resale"'));
 assert.ok(read('app.js').includes('voltcheck.html'));
 assert.ok(fs.existsSync(path.join(root,'voltcheck.html')));
});
