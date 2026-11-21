'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../passport-core.js'),'utf8');
const ctx={};vm.createContext(ctx);vm.runInContext(code,ctx);
const core=ctx.VoltPassportCore;
const sample=(x={})=>x;
test('v1 contains exactly 11 smartphone checks with unique IDs',()=>{
  assert.equal(core.CHECKS.length,11);assert.equal(new Set(core.CHECKS.map(x=>x.id)).size,11);
});
test('default values are unknown, never automatically verified',()=>{
  const result=core.summarize({});assert.equal(result.filled,0);assert.equal(result.unknown,11);
});
test('normalization strips unknown keys and invalid statuses',()=>{
  const x=core.normalize({screen:{status:'ok',note:' works '},fake:{status:'ok'},imei:{status:'verified',note:'Y'}});
  assert.equal(x.screen.status,'ok');assert.equal(x.screen.note,'works');assert.equal(x.imei.status,'unknown');assert.equal(x.fake,undefined);
});
test('seller issue remains visible in summary even without buyer check',()=>{
  const result=core.summarize({activation:{status:'issue'},battery:{status:'ok'}});
  assert.equal(result.issue,1);assert.equal(result.filled,2);assert.equal(result.criticalIssues[0],'activation');
});
test('critical mismatch detected if seller says ok and buyer finds issue',()=>{
  const result=core.compare(sample({imei:{status:'ok'}}),sample({imei:{status:'issue'}}));
  assert.equal(result.mismatches.includes('imei'),true);
  assert.equal(result.criticalMismatches.includes('imei'),true);
});
test('no mismatch for confirmed matching defect',()=>{
  const result=core.compare({camera:{status:'issue'}},{camera:{status:'issue'}});
  assert.equal(result.matches,1);assert.equal(result.mismatches.length,0);
});
test('unknown seller state is unconfirmed, not a false mismatch',()=>{
  const result=core.compare({},{imei:{status:'issue'}});
  assert.equal(result.unconfirmed.includes('imei'),true);assert.equal(result.mismatches.length,0);
});
test('unknown buyer state is not counted as a confirmed test',()=>{
  const result=core.compare({screen:{status:'ok'}},{});assert.equal(result.checked,0);
});
test('notes normalized and limited to 180 chars, including control characters',()=>{
  const x=core.normalize({screen:{status:'ok',note:'A\u0000\nB '+'x'.repeat(210)}});
  assert.equal(x.screen.note.includes('\u0000'),false);assert.ok(x.screen.note.length<=180);
});
test('VoltCheck state imports only known check statuses',()=>{
  const x=core.normalizeVoltCheck({state:{battery:{status:'issue'},camera:{status:'ok'},bad:{status:'ok'}}});
  assert.equal(x.battery.status,'issue');assert.equal(x.camera.status,'ok');assert.equal(x.bad,undefined);
});
test('prototype pollution payloads are ignored',()=>{
  const x=core.normalize(JSON.parse('{"__proto__":{"status":"ok"},"screen":{"status":"ok"}}'));
  assert.equal(x.screen.status,'ok');assert.equal(Object.keys(x).includes('__proto__'),false);
});
