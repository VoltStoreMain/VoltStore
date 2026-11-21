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
