/* VoltGuide UI. No outbound requests until explicit AI consent + click. */
(function(){
'use strict';
const core=window.VoltPassportCore, guide=window.VoltGuideCore;
if(!core||!guide) return;
const $=id=>document.getElementById(id), params=new URLSearchParams(location.search);
const allowedCategory=core.resolveCategory(params.get('category'));
const adId=/^[a-zA-Z0-9_-]{1,80}$/.test(params.get('ad')||'')?params.get('ad'):'';
const initialModel=guide.clean(params.get('model'),90);
const initialPrice=Number(params.get('price'));
let lastAdvice=null;
function addItems(id,items){
 const root=$(id);root.replaceChildren();
 for(const text of items){const li=document.createElement('li');li.textContent=text;root.appendChild(li);}
}
function storedInspection(category){
 const key='voltcheck-universal-v1:'+category+':'+(adId||'manual');
 let data=null;
 try{data=JSON.parse(sessionStorage.getItem(key)||'null');}catch(_){}
 if(data&&data.state) return data.state;
 if(category==='smartphone'){
   try{data=JSON.parse(sessionStorage.getItem('voltcheck-v1:'+(adId||initialModel.toLowerCase()||'manual'))||'null');}catch(_){}
   if(data&&data.state)return data.state;
 }
 return {};
}
function inputs(){
 return {category:$('category').value,mode:$('mode').value,model:$('model').value,
  price:$('price').value,inspection:storedInspection($('category').value),question:$('question').value};
}
function updateLinks(){
 const cat=$('category').value;
 const args=new URLSearchParams({category:cat});
 if(adId)args.set('ad',adId);
 if($('model').value.trim())args.set('model',$('model').value.trim().slice(0,90));
 if($('price').value)args.set('price',$('price').value);
 $('goCheck').href='voltcheck-all.html?'+args.toString();
 const p=new URLSearchParams({demo:'1',category:cat});
 $('goPassport').href='voltpassport.html?'+p.toString();
}
function analyze(){
 const data=inputs(), advice=guide.advise(core,data);lastAdvice=advice;
 $('headline').textContent=advice.headline;
 $('summary').textContent=advice.summary;
 $('meta').textContent=advice.name+' · '+advice.price;
 addItems('warnings',advice.warnings);
 addItems('questions',advice.questions);
 addItems('steps',advice.steps);
 $('disclaimer').textContent=advice.disclaimer;
 $('contextNotice').textContent=advice.stats.untested===advice.stats.total?
    'Результаты осмотра ещё не загружены. Для персональных советов отметьте проверки в VoltCheck и вернитесь в ту же вкладку.':
    'Учтены ваши отметки: проблем '+advice.stats.issues+', не проверено '+advice.stats.untested+' из '+advice.stats.total+'.';
 updateLinks();
}
async function copyQuestions(){
 if(!lastAdvice)analyze();
 const data=lastAdvice.questions.map((q,i)=>(i+1)+'. '+q).join('\n');
 try{await navigator.clipboard.writeText(data);$('copyQuestions').textContent='Скопировано ✓';}
 catch(_){$('copyQuestions').textContent='Не удалось скопировать';}
 setTimeout(()=>$('copyQuestions').textContent='Копировать вопросы',2200);
}
function result(text,error){
 const element=$('aiResult');element.hidden=false;element.className='ai-response'+(error?' error':'');element.textContent=text;
}
let sdkPromise=null;
function ensureAuthLibrary(){
 if(window.supabase)return Promise.resolve(window.supabase);
 if(!sdkPromise){
   sdkPromise=new Promise((resolve,reject)=>{
     const script=document.createElement('script');
     script.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js';
     script.async=true;
     script.onload=()=>window.supabase?resolve(window.supabase):reject(new Error('Библиотека авторизации не загрузилась.'));
     script.onerror=()=>reject(new Error('Нет связи с сервером авторизации. Бесплатные рекомендации доступны.'));
     document.head.appendChild(script);
   }).catch(err=>{sdkPromise=null;throw err;});
 }
 return sdkPromise;
}
async function ask(){
 if(!$('consent').checked){result('Чтобы отправить вопрос AI-провайдеру, сначала подтвердите согласие.',true);return;}
 let payload;
 try{payload=guide.aiPayload(core,inputs());}
 catch(e){result(e.message,true);return;}
 const conf=window.VOLT_CONFIG||{};
 if(!conf.supabaseUrl||!conf.supabaseAnonKey){result('Пока недоступен вход VoltStore. Экспертные подсказки выше работают бесплатно.',true);return;}
 const btn=$('askAI');btn.disabled=true;btn.textContent='Проверяю подключение…';
 try{
   const sdk=await ensureAuthLibrary();
   const sb=sdk.createClient(conf.supabaseUrl,conf.supabaseAnonKey);
   const {data:{session}}=await sb.auth.getSession();
   if(!session||!session.access_token)throw new Error('Для экспериментального AI-режима сначала войдите в VoltStore. Бесплатный экспертный режим доступен без входа.');
   const response=await fetch('/.netlify/functions/voltguide-ai',{method:'POST',
     headers:{'content-type':'application/json','authorization':'Bearer '+session.access_token},
     body:JSON.stringify(payload),signal:AbortSignal.timeout(16000)});
   const json=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(typeof json.error==='string'?json.error:'AI сейчас недоступен. Используйте рекомендации выше.');
   if(typeof json.answer!=='string'||!json.answer.trim())throw new Error('AI не вернул ответ.');
   result(json.answer,false);
 }catch(e){result(e.name==='TimeoutError'?'Истекло время ожидания. Попробуйте позже.':guide.clean(e.message||'AI сейчас недоступен.',240),true);}
 finally{btn.disabled=false;btn.textContent='Спросить AI';}
}
for(const id of core.CATEGORY_IDS){
 const c=core.getCategory(id),o=document.createElement('option');o.value=id;o.textContent=c.icon+' '+c.label;$('category').appendChild(o);
}
$('category').value=allowedCategory;
if(initialModel)$('model').value=initialModel;
if(Number.isFinite(initialPrice)&&initialPrice>0&&initialPrice<100000000)$('price').value=String(Math.round(initialPrice));
$('analyze').addEventListener('click',analyze);
$('copyQuestions').addEventListener('click',copyQuestions);
$('askAI').addEventListener('click',ask);
['category','mode','model','price'].forEach(id=>$(id).addEventListener('change',analyze));
window.addEventListener('pageshow',analyze);
analyze();
})();