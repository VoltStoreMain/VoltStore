'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../passport-core.js'),'utf8');
const ctx={};vm.createContext(ctx);vm.runInContext(code,ctx);
const c=ctx.VoltPassportCore;
for(const id of ['smartphone','laptop','furniture','bicycle']){
 test(`${id}: checks are unique and all start unknown`,()=>{
  const checks=c.getChecks(id);assert.ok(checks.length>=10);assert.equal(new Set(checks.map(x=>x.id)).size,checks.length);
  const s=c.summarize(null,id);assert.equal(s.filled,0);assert.equal(s.unknown,checks.length);assert.ok(s.criticalUnknown.length>0);
 });
 test(`${id}: critical mismatch and buyer issue detected`,()=>{
  const important=c.getChecks(id).find(x=>x.critical);
  const a={[important.id]:{status:'ok'}},b={[important.id]:{status:'issue'}};
  const x=c.compare(a,b,id);assert.ok(x.criticalMismatches.includes(important.id));assert.ok(x.buyerCriticalIssues.includes(important.id));
 });
 test(`${id}: reports include correct category and no hidden fields`,()=>{
  const first=c.getChecks(id)[0].id;
  const text=c.report({category:id,model:'  Товар \n 01 ',price:59000},{[first]:{status:'ok',note:'good'}},{[first]:{status:'issue',note:'bad'}},new Date('2026-11-21T10:00:00Z'));
  assert.ok(text.includes(c.getCategory(id).label));assert.ok(text.includes('59 000')||text.includes('59 000'));
  assert.ok(text.includes('bad'));assert.ok(text.includes('НЕ СЕРТИФИКАТ'));
 });
 test(`${id}: extra and prototype keys never copied`,()=>{
  const unknown=JSON.parse('{"__proto__":{"status":"ok"},"evil":{"status":"ok"}}');
  const s=c.normalize(unknown,id);assert.equal(s.evil,undefined);assert.equal(Object.keys(s).length,c.getChecks(id).length);
 });
}
test('unknown category resolves to smartphone, preventing injection',()=>{
 assert.equal(c.resolveCategory('..\\<script>'),'smartphone');assert.equal(c.getChecks('evil').length,11);
});
test('portable report normalizes unsafe controls and overlong notes',()=>{
 const t=c.report({category:'furniture',model:'A\u0000B',price:12}, {frame:{status:'ok',note:'!'.repeat(500)}}, {},new Date('bad'));
 assert.equal(t.includes('\u0000'),false);assert.equal(t.includes('!'.repeat(181)),false);
});
test('buyer unknown is never treated as verified or matching',()=>{
 const r=c.compare({frame:{status:'ok'}},{frame:{status:'unknown'}},'furniture');
 assert.equal(r.checked,0);assert.equal(r.matches,0);assert.equal(r.mismatches.length,0);
});
test('critical buyer issue with unknown seller is flagged',()=>{
 const r=c.compare({}, {brakes:{status:'issue'}},'bicycle');
 assert.ok(r.buyerCriticalIssues.includes('brakes'));assert.ok(r.unconfirmed.includes('brakes'));
});
