'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
for(const pair of [['voltpassport.html','passport-app.js'],['voltcheck-all.html','voltcheck-all.js']]){
 const [html,script]=pair;
 test(`${html}: all DOM id selectors used by ${script} exist`,()=>{
   const markup=read(html),js=read(script);
   const selectors=[...js.matchAll(/\$\('([A-Za-z0-9_-]+)'\)/g)].map(m=>m[1]);
   const missing=[...new Set(selectors)].filter(id=>!markup.includes('id="'+id+'"'));
   assert.deepEqual(missing,[]);
 });
 test(`${html}: references to local scripts and styles exist`,()=>{
   const markup=read(html);
   const src=[...markup.matchAll(/(?:src|href)="([a-zA-Z0-9-]+\.(?:css|js))"/g)].map(m=>m[1]);
   assert.ok(src.length>=3);
   for(const f of src)if(f!=="config.js")assert.ok(fs.existsSync(path.join(root,f)),f); // config.js lives in the parent GitHub repo, not the portable prototype bundle.
 });
}
test('live schema draft remains smartphone-only (no untested migration)',()=>{
 const s=read('supabase/voltpassport_schema_draft.sql');
 assert.match(s,/check \(category = 'smartphone'\)/);
 assert.ok(!s.includes("category in ('smartphone','furniture'"));
});
test('universal inspector stores data only locally',()=>{
 const s=read('voltcheck-all.js');
 assert.ok(s.includes('sessionStorage'));
 assert.ok(!s.includes('.from('));
 assert.ok(!s.includes('fetch('));
});

test('universal category engine has no billing or tracking dependencies',()=>{ const source=read('passport-core.js')+read('voltcheck-all.js'); assert.ok(!source.includes('service_role')); assert.ok(!source.includes('apikey')); assert.ok(!source.includes('analytics.capture')); });
