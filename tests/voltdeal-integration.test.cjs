'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
test('VoltDeal page defines every selector used by its controller',()=>{
 const html=read('voltdeal.html'),js=read('voltdeal.js');
 const selectors=[...js.matchAll(/\$\('([A-Za-z0-9_-]+)'\)/g)].map(m=>m[1]);
 const missing=[...new Set(selectors)].filter(id=>!html.includes('id="'+id+'"'));
 assert.deepEqual(missing,[]);
});
test('VoltDeal page links actual local scripts and styles',()=>{
 const html=read('voltdeal.html'),assets=[...html.matchAll(/(?:src|href)="([a-zA-Z0-9-]+\.(?:css|js))"/g)].map(m=>m[1]);
 for(const a of ['market.css','voltdeal.css','passport-core.js','market-core.js','voltdeal-core.js','voltdeal.js'])
   assert.ok(assets.includes(a),a);
 for(const a of assets)assert.ok(fs.existsSync(path.join(root,a)),a);
});
test('No real payment, data collection or server writes from VoltDeal browser app',()=>{
 const s=read('voltdeal.js')+read('voltdeal-core.js');
 assert.ok(s.includes('localStorage'));
 assert.ok(s.includes('sessionStorage'));
 assert.ok(!/\b(?:fetch|XMLHttpRequest)\s*\(/.test(s));
 assert.ok(!/\b(?:SB|supabase)\.from\s*\(/.test(s));
 assert.ok(!s.includes('OPENAI_API_KEY'));
 assert.ok(!s.includes('paymentProvider'));
});
test('VoltMarket listing detail provides explicit contextual entry to VoltDeal',()=>{
 const js=read('market.js'),core=read('market-core.js'),html=read('market.html');
 assert.ok(js.includes("core.link(item,'deal')"));
 assert.ok(js.includes('Попробовать оформление'));
 assert.ok(js.includes('настоящей брони и оплаты нет'));
 assert.ok(core.includes("if(target==='deal')"));
 assert.ok(html.includes('Оформить VoltDeal'));
});
test('Demo roles are explicit and no false claim of live reservation',()=>{
 const html=read('voltdeal.html'),js=read('voltdeal.js');
 assert.match(html,/Денежных операций нет/);
 assert.match(html,/нико(?:го|му) не уведомляют|никого не уведомляют/);
 assert.ok(js.includes("role='buyer'"));
 assert.ok(js.includes('seller_confirm'));
 assert.ok(js.includes('buyer_inspect'));
 assert.ok(js.includes('buyer_confirm'));
});
test('VoltDeal links user to the exact listing and companion verification tools',()=>{
 const js=read('voltdeal.js');
 for(const url of ["market.link(item,'item')","market.link(item,'passport')","market.link(item,'guide')","market.link(item,'check')"])
  assert.ok(js.includes(url),url);
});
test('Personal safety states block unconfirmed handover',()=>{
 const core=read('voltdeal-core.js');
 assert.ok(core.includes('options.handoverConfirmed!==true'));
 assert.ok(core.includes('options.acceptRisk!==true'));
 assert.ok(core.includes('personallyChecked!==true'));
});
test('Page does not get indexed as real offers or collect card numbers',()=>{
 const html=read('voltdeal.html');
 assert.ok(html.includes('noindex,nofollow'));
 assert.ok(!/name="(?:cardNumber|cvv|address|phone)"/i.test(html));
 assert.ok(html.includes('Нет настоящей брони'));
});
