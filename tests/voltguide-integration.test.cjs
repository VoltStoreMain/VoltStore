'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=x=>fs.readFileSync(path.join(__dirname,'..',x),'utf8');
test('guide all DOM IDs exist and JS syntax references only defined nodes',()=>{
 const html=read('voltguide.html'),script=read('voltguide.js');
 const ids=[...script.matchAll(/\$\('([A-Za-z0-9_-]+)'\)/g)].map(m=>m[1]);
 const absent=[...new Set(ids)].filter(x=>!html.includes('id="'+x+'"'));
 assert.deepEqual(absent,[]);
});
test('all local VoltGuide assets exist',()=>{
 const html=read('voltguide.html');
 const assets=[...html.matchAll(/(?:href|src)="([a-zA-Z0-9-]+\.(?:css|js))"/g)].map(x=>x[1]);
 assert.ok(assets.length>=4);
 for(const asset of assets)assert.ok(fs.existsSync(path.join(__dirname,'..',asset)),asset);
});
test('VoltGuide integrated in menu, ad details and universal check',()=>{
 assert.ok(read('index.html').includes('href="voltguide.html"'));
 assert.ok(read('app.js').includes('voltguide.html?category=smartphone'));
 assert.ok(read('voltcheck-all.html').includes('id="openGuide"'));
 assert.ok(read('voltpassport.html').includes('href="voltguide.html"'));
});
test('AI server has opt-in closed gate, no hardcoded API secret',()=>{
 const source=read('netlify/functions/voltguide-ai.mjs');
 assert.match(source,/VOLTGUIDE_AI_ENABLED/);
 assert.match(source,/VOLTGUIDE_ALLOWED_USER_IDS/);
 assert.match(source,/OPENAI_API_KEY/);
 assert.match(source,/store:false/);
 assert.ok(!/sk-[A-Za-z0-9_-]{25,}/.test(source));
});
test('VoltCheck and VoltPassport remain intact',()=>{
 const core=read('passport-core.js');
 assert.ok(core.includes('CATEGORIES'));
 assert.ok(read('voltcheck-all.html').includes('id="checksList"'));
 assert.ok(read('voltpassport.html').includes('id="checksList"'));
});
