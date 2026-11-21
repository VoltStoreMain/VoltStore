'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const pages=['market.html','voltdeal.html','voltguide.html','voltcheck-all.html','voltpassport.html'];
test('shared mobile shell attached to every relevant buyer/seller page',()=>{
 for(const page of pages){
  const html=read(page);
  assert.ok(html.includes('href="mobile-shell.css"'),page+' CSS missing');
  assert.ok(html.includes('src="mobile-shell.js"'),page+' JS missing');
 }
});
test('mobile navigation only advertises usable pages and never payment',()=>{
 const js=read('mobile-shell.js');
 for(const path of ['market.html#discover','market.html#draft','voltguide.html','voltcheck-all.html'])
  assert.ok(js.includes(path),path);
 assert.match(js,/aria-label','Мобильная навигация/);
 assert.ok(!js.includes('Оплатить'));
 assert.ok(!/\bfetch\s*\(/.test(js));
});
test('mobile buyer action uses selected listing link and keeps inspection shortcut',()=>{
 const js=read('mobile-shell.js'),market=read('market.js');
 assert.ok(js.includes('a[href^="voltdeal.html?"]'));
 assert.ok(js.includes('a[href^="voltcheck-all.html?"]'));
 assert.ok(market.includes("core.link(item,'deal')"));
});
test('sticky deal action delegates to existing button and does not bypass required form fields',()=>{
 const js=read('mobile-shell.js'),deal=read('voltdeal.js');
 assert.ok(js.includes('action.element.click()'));
 assert.ok(!js.includes('form.submit('));
 assert.ok(deal.includes('reportValidity')||deal.includes("const form=$('actionContent')")||deal.includes("form.checkValidity"));
});
test('responsive layout includes thumb area, small screen and iOS-safe inset',()=>{
 const css=read('mobile-shell.css');
 assert.match(css,/@media\(max-width:760px\)/);
 assert.match(css,/@media\(max-width:355px\)/);
 assert.ok(css.includes('env(safe-area-inset-bottom)'));
 assert.ok(css.includes('min-height:50px'));
 assert.ok(css.includes('grid-template-columns:repeat(2,minmax(0,1fr))'));
 assert.ok(css.includes('font-size:16px'));
});
test('advanced filters preserve original IDs and remain expanded on desktop',()=>{
 const js=read('mobile-shell.js'),page=read('market.html');
 assert.ok(js.includes("advanced.open=!media.matches"));
 assert.ok(js.includes("fields.appendChild(node)"));
 for(const id of ['search','city','condition','maxPrice','sort','attributeFilter'])
   assert.ok(page.includes('id="'+id+'"'),id);
});
test('mobile shell has no API key, auth, financial backend or personal data collection',()=>{
 const js=read('mobile-shell.js'),css=read('mobile-shell.css');
 assert.ok(!['OPENAI_API_KEY','service_role','fetch(','supabase.from(','SB.from(','pay('].some(token=>js.includes(token)));
 assert.ok(!js.includes('localStorage'));
 assert.ok(!/data-cardnumber|data-ccnumber/.test(js+css));
});
