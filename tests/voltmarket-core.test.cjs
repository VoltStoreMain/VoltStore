'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const market=require('../market-core.js');
require('../passport-core.js');
const passport=globalThis.VoltPassportCore;
test('catalog: four universal categories stay aligned with checks',()=>{
  assert.deepEqual([...market.CATEGORY_IDS].sort(),[...passport.CATEGORY_IDS].sort());
  for(const id of market.CATEGORY_IDS){assert.equal(market.category(id).fields.length,3);assert.equal(passport.getChecks(id).length,11);}
});
test('catalog: all eight example listings are clearly demo, valid, and unique',()=>{
  const list=market.samples(),ids=new Set(list.map(x=>x.id));
  assert.equal(list.length,8);assert.equal(ids.size,8);
  for(const item of list){assert.equal(item.kind,'demo');assert.ok(item.title.length>=4);assert.ok(item.price>0);assert.ok(item.city);}
});
test('catalog: each category has a pair of sample listings',()=>{
  for(const id of market.CATEGORY_IDS)assert.equal(market.samples().filter(x=>x.category===id).length,2);
});
test('catalog: reject unknown category and malformed object',()=>{
  assert.equal(market.normalize({category:'gaming',id:'draft-123456'}),null);
  assert.equal(market.normalize([]),null);
  assert.equal(market.normalize(null),null);
});
test('catalog: rejects low price, missing title, unapproved condition',()=>{
  const base={id:'draft-123456789',kind:'draft',category:'laptop',title:'Lenovo T14',city:'Алматы',price:20000,condition:'Хорошее'};
  assert.equal(market.normalize({...base,price:-1}),null);
  assert.equal(market.normalize({...base,title:'x'}),null);
  assert.equal(market.normalize({...base,condition:'Подтверждено VoltStore'}),null);
  assert.ok(market.normalize(base));
});
test('catalog: attrs strictly whitelist category options and ranges',()=>{
  const base={id:'draft-123456789',kind:'draft',category:'furniture',title:'Мягкий диван',city:'Алматы',price:50000,condition:'Хорошее'};
  const item=market.normalize({...base,attrs:{kind:'Диван',material:'Бетон',width:1200,phone:'12345678',__proto__:'oops'}});
  assert.equal(item.attrs.kind,'Диван');
  assert.ok(!Object.hasOwn(item.attrs,'material'));
  assert.ok(!Object.hasOwn(item.attrs,'width'));
  assert.ok(!Object.hasOwn(item.attrs,'phone'));
  assert.equal(Object.getPrototypeOf(item.attrs),null);
});
test('catalog: seller claims constrained to known status values',()=>{
  const base={id:'draft-123456789',kind:'draft',category:'smartphone',title:'iPhone Pro',city:'Алматы',price:200000,condition:'Хорошее'};
  const i=market.normalize({...base,claims:{imei:'issue',screen:'certified',test:'unknown'}});
  assert.equal(i.claims.imei,'issue');assert.ok(!Object.hasOwn(i.claims,'screen'));
});
test('discovery: search, category, city and price filters',()=>{
  const items=market.samples();
  assert.equal(market.filter(items,{category:'laptop'}).length,2);
  assert.equal(market.filter(items,{city:'Алматы'}).length,4);
  assert.equal(market.filter(items,{q:'Диван'}).length,1);
  assert.equal(market.filter(items,{category:'smartphone',maxPrice:200000}).length,1);
  assert.equal(market.filter(items,{q:'abc-unknown'}).length,0);
});
test('discovery: category-specific attribute filter and sort',()=>{
  const items=market.samples();
  const a=market.filter(items,{category:'furniture',attribute:'kind',attributeValue:'Диван'});
  assert.equal(a.length,1);
  assert.equal(a[0].attrs.kind,'Диван');
  const sorted=market.filter(items,{sort:'priceAsc'});
  assert.equal(sorted[0].price,Math.min(...items.map(x=>x.price)));
  const desc=market.filter(items,{sort:'priceDesc'});
  assert.equal(desc[0].price,Math.max(...items.map(x=>x.price)));
});
test('links: contextual paths are encoded and exact',()=>{
 const x=market.normalize({id:'draft-test_12345',kind:'draft',category:'furniture',title:'Диван & кресло',city:'Алматы',price:60000,condition:'Хорошее'});
 const url=new URL(market.link(x,'guide'),'https://example.test/');
 assert.equal(url.pathname,'/voltguide.html');
 assert.equal(url.searchParams.get('category'),'furniture');
 assert.equal(url.searchParams.get('ad'),x.id);
 assert.equal(url.searchParams.get('model'),x.title);
 const passport=new URL(market.link(x,'passport'),'https://example.test/');
 assert.equal(passport.searchParams.get('demo'),'1');
 assert.equal(passport.searchParams.get('ad'),x.id);
 const check=new URL(market.link(x,'check'),'https://example.test/');
 assert.equal(check.pathname,'/voltcheck-all.html');
});
test('category names do not trust unknown input',()=>{
 assert.equal(market.category('<script>alert(1)</script>').id,'smartphone');
});
test('normalize strips control characters and limits length',()=>{
 const x=market.clean('text\u0000   two',10);
 assert.equal(x,'text two');
});
