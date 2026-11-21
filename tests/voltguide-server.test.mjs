import test from 'node:test';
import assert from 'node:assert/strict';
import handler,{validate,extractAnswer} from '../netlify/functions/voltguide-ai.mjs';
const req=(payload,auth='')=>new Request('https://example.netlify.app/.netlify/functions/voltguide-ai',{
 method:'POST',headers:{'content-type':'application/json',...(auth?{authorization:auth}:{})},body:JSON.stringify(payload)});
const basic={category:'smartphone',mode:'buy',model:'iPhone',price:'250000 ₸',question:'Что проверить перед покупкой?'};
test('validator rejects unknown and oversized inputs',()=>{
 assert.equal(validate({...basic,category:'medicine'}),null);
 assert.equal(validate({...basic,question:'a'.repeat(451)}),null);
 assert.ok(validate(basic));
});
test('server redacts contacts as defense in depth',()=>{
 const a=validate({...basic,question:'мой IMEI 123456789012345 и email person@example.org'});
 assert.ok(!a.question.includes('123456789012345'));
 assert.ok(!a.question.includes('person@example.org'));
});
test('extractAnswer only uses text output, not hidden internal fields',()=>{
 assert.equal(extractAnswer({output:[{type:'message',content:[{type:'output_text',text:'Проверьте батарею.'}]}]}),'Проверьте батарею.');
 assert.equal(extractAnswer({output:[{type:'reasoning',text:'secret'}]}),'');
});
test('default endpoint is disabled without billing/authorization',async()=>{
 const old=process.env.VOLTGUIDE_AI_ENABLED;delete process.env.VOLTGUIDE_AI_ENABLED;
 try{const r=await handler(req(basic));assert.equal(r.status,503);assert.match((await r.json()).error,/не подключён/);}
 finally{if(old===undefined)delete process.env.VOLTGUIDE_AI_ENABLED;else process.env.VOLTGUIDE_AI_ENABLED=old;}
});
test('when enabled without configured provider it fails closed',async()=>{
 const keys=['VOLTGUIDE_AI_ENABLED','VOLTGUIDE_ALLOWED_USER_IDS','OPENAI_API_KEY','VOLTGUIDE_AI_MODEL','VOLTGUIDE_SUPABASE_URL','VOLTGUIDE_SUPABASE_KEY'];
 const old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 try{
 process.env.VOLTGUIDE_AI_ENABLED='true';
 keys.slice(1).forEach(k=>delete process.env[k]);
 const r=await handler(req(basic));assert.equal(r.status,503);
 }finally{for(const k of keys){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}}
});

test('enabled pilot calls AI only after server-verified allowlisted user',async()=>{
 const keys=['VOLTGUIDE_AI_ENABLED','VOLTGUIDE_ALLOWED_USER_IDS','OPENAI_API_KEY','VOLTGUIDE_AI_MODEL','VOLTGUIDE_SUPABASE_URL','VOLTGUIDE_SUPABASE_KEY'];
 const old=Object.fromEntries(keys.map(k=>[k,process.env[k]])),origFetch=globalThis.fetch;
 let count=0;
 try{
   Object.assign(process.env,{
     VOLTGUIDE_AI_ENABLED:'true',VOLTGUIDE_ALLOWED_USER_IDS:'person-allowed',
     OPENAI_API_KEY:'test-key-only',VOLTGUIDE_AI_MODEL:'test-model',
     VOLTGUIDE_SUPABASE_URL:'https://example.supabase.co',VOLTGUIDE_SUPABASE_KEY:'test-anon'
   });
   globalThis.fetch=async(url,init)=>{
     count++;
     if(String(url).includes('/auth/v1/user')) {
       assert.equal(init.headers.Authorization,'Bearer sample.jwt.signature');
       return new Response(JSON.stringify({id:'person-allowed'}),{status:200});
     }
     assert.equal(String(url),'https://api.openai.com/v1/responses');
     const sent=JSON.parse(init.body);
     assert.equal(sent.model,'test-model');assert.equal(sent.store,false);assert.equal(sent.max_output_tokens,350);
     assert.ok(!init.body.includes('private@example.com'));
     return new Response(JSON.stringify({output:[{type:'message',content:[{type:'output_text',text:'Сверьте IMEI и проверьте связь.'}]}]}),{status:200});
   };
   const r=await handler(req({...basic,model:'private@example.com'},'Bearer sample.jwt.signature'));
   assert.equal(r.status,200);assert.match((await r.json()).answer,/IMEI/);assert.equal(count,2);
 }finally{
   globalThis.fetch=origFetch;
   for(const k of keys){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}
 }
});
