'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
require('../passport-core.js');
const core=globalThis.VoltPassportCore, guide=require('../voltguide-core.js');
function state(id,status){return {[id]:{status}};}
test('all four catalog categories are available',()=>{
 assert.deepEqual(core.CATEGORY_IDS.slice().sort(),['bicycle','furniture','laptop','smartphone'].sort());
 for(const category of core.CATEGORY_IDS){
  const r=guide.advise(core,{category,mode:'buy'});
  assert.equal(r.stats.total,11);
  assert.equal(r.stats.untested,11);
  assert.equal(r.questions.length,4);
 }
});
test('returns concrete checks for laptop',()=>{
 const r=guide.advise(core,{category:'laptop',mode:'buy'});
 assert.equal(r.category,'laptop');assert.match(r.questions.join(' '),/BIOS|MDM/);
});
test('furniture includes structural risks',()=>{
 const r=guide.advise(core,{category:'furniture',mode:'inspect'});
 assert.ok(r.questions.length>=1);assert.ok(core.getChecks('furniture').some(c=>/каркас/i.test(c.title)));
});
test('unknown category does not inject arbitrary text',()=>{
 assert.equal(guide.advise(core,{category:'<script>alert(1)</script>'}).category,'smartphone');
});
test('critical buyer problem warns before payment',()=>{
 const r=guide.advise(core,{category:'smartphone',inspection:state('activation','issue')});
 assert.equal(r.stats.critical,1);assert.match(r.warnings.join(' '),/Отложите оплату/);
});
test('non-critical issue is not represented as verified fraud',()=>{
 const r=guide.advise(core,{category:'smartphone',inspection:state('battery','issue')});
 assert.equal(r.stats.critical,0);assert.equal(r.stats.issues,1);
 assert.ok(!/мошенничество|сертифицирован/.test(r.headline));
});
test('fully marked ok stays cautious',()=>{
 const all=Object.fromEntries(core.getChecks('smartphone').map(c=>[c.id,{status:'ok'}]));
 const r=guide.advise(core,{category:'smartphone',inspection:all});
 assert.equal(r.stats.untested,0);assert.match(r.warnings.join(' '),/не гарантия/);
});
test('seller advice prompts honest disclosure',()=>{
 const r=guide.advise(core,{category:'furniture',mode:'sell'});
 assert.match(r.steps.join(' '),/дефекты|заполните/i);
});
test('price is shown but never called fair market value',()=>{
 const r=guide.advise(core,{category:'laptop',model:'ThinkPad',price:125000});
 assert.match(r.price,/125.000|125 000|125 000/u); assert.ok(!/рыночная стоимость|справедливая цена/i.test(r.summary));
});
test('contacts are redacted before optional AI',()=>{
 const payload=guide.aiPayload(core,{category:'smartphone',mode:'buy',question:'Телефон +7 777 123 45 67, imei 123456789012345 и почта test@example.com'});
 assert.ok(!payload.question.includes('777'));assert.ok(!payload.question.includes('123456789012345'));assert.ok(!payload.question.includes('test@example.com'));
});
test('AI request rejects empty question',()=>{
 assert.throws(()=>guide.aiPayload(core,{category:'smartphone',question:'   '}),/Введите вопрос/);
});
test('AI request passes minimal whitelisted context',()=>{
 const payload=guide.aiPayload(core,{category:'bicycle',mode:'inspect',question:'Как проверить тормоза?'});
 assert.deepEqual(Object.keys(payload).sort(),['category','flags','mode','model','price','question']);
 assert.equal(payload.category,'bicycle');
});
