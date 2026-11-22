/* VoltPassport v1: seller declarations in Supabase; buyer checks stay in sessionStorage. */
(function () {
  'use strict';
  const core = window.VoltPassportCore;
  if (!core) return;
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const isDemo = params.get('demo') === '1';
  const rawAdId = params.get('ad') || '';
  const adId = /^[\w-]{1,80}$/.test(rawAdId) ? rawAdId : '';
  const mockId = adId || 'sample-product';
  const market=window.VoltMarketCore;
  function linkedMarketListing(){
    if(!isDemo||!market||!adId)return null;
    const example=market.samples().find(x=>x.id===adId);
    if(example)return example;
    try{
      const raw=JSON.parse(localStorage.getItem('voltmarket-local-drafts-v1')||'[]');
      return Array.isArray(raw)?raw.slice(0,30).map(market.normalize).find(x=>x&&x.kind==='draft'&&x.id===adId)||null:null;
    }catch(_){return null;}
  }
  let category = isDemo ? core.resolveCategory(params.get('category')) : 'smartphone';
  const sessionKey = () => 'voltpassport-buyer-v2:' + mockId + ':' + category;
  const sellerDrafts = Object.create(null);
  const VOLTCHECK_KEY = 'voltcheck-v1:' + mockId;
  let sb=null, user=null, ad=null, passport=null, editable=false, pending=false;
  let sellerState=core.normalize(), buyerState=core.normalize();
  let timer;

  function safeSessionRead(key) { try { return JSON.parse(sessionStorage.getItem(key) || 'null'); } catch (_) { return null; } }
  function saveBuyer() { try { sessionStorage.setItem(sessionKey(), JSON.stringify(buyerState)); } catch (_) {} }
  function notify(msg) {
    clearTimeout(timer); const el=$('toast');el.textContent=msg;el.classList.add('visible');
    timer=setTimeout(()=>el.classList.remove('visible'),3400);
  }
  function setNotice(msg,kind) { const el=$('notice');el.hidden=!msg;el.textContent=msg||'';el.className='notice '+(kind||''); }
  function money(v) {const n=Number(v);return Number.isFinite(n)&&n>0?Math.round(n).toLocaleString('ru-RU')+' ₸':'Цена не указана';}
  function formatDate(iso) {const n=Date.parse(iso||'');return Number.isFinite(n)?new Date(n).toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'}):'Дата не указана';}
  function el(tag,cls,content) {const n=document.createElement(tag);if(cls)n.className=cls;if(content!=null)n.textContent=content;return n;}
  function makeButton(text,status,mode,id,active) {
    const b=el('button','choice'+(active?' active':''),text);
    b.type='button';b.dataset.status=status;b.dataset.mode=mode;b.dataset.key=id;
    b.setAttribute('aria-pressed',active?'true':'false');return b;
  }
  function sellerCol(check) {
    const value=sellerState[check.id], box=el('div','check-col');
    box.appendChild(el('div','col-label','ПРОДАВЕЦ · СО СВОИХ СЛОВ'));
    if (editable) {
      const choices=el('div','choices');
      [['ok','✓ Исправно'],['issue','! Есть проблема'],['unknown','? Не знаю']].forEach(([key,label])=>choices.appendChild(makeButton(label,key,'seller',check.id,value.status===key)));
      box.appendChild(choices);
      const note=el('textarea','note-input');note.name='seller-note';note.dataset.key=check.id;note.maxLength=180;note.rows=2;
      note.placeholder='Пояснение продавца (без IMEI, телефонов и личных данных)';note.value=value.note;
      box.appendChild(note);
    } else {
      box.appendChild(el('div','status-display '+value.status,core.STATUS[value.status]));
      if (value.note) box.appendChild(el('div','note-display',value.note));
    }
    return box;
  }
  function buyerCol(check) {
    const value=buyerState[check.id],box=el('div','check-col');
    box.appendChild(el('div','col-label','МОЯ ПРОВЕРКА · ТОЛЬКО В ЭТОЙ ВКЛАДКЕ'));
    const choices=el('div','choices');
    [['ok','✓ Работает'],['issue','! Не работает'],['unknown','? Не проверял']].forEach(([key,label])=>choices.appendChild(makeButton(label,key,'buyer',check.id,value.status===key)));
    box.appendChild(choices);
    const note=el('textarea','note-input');note.name='buyer-note';note.dataset.key=check.id;note.maxLength=180;note.rows=2;note.placeholder='Мои замечания (не публикуются)';note.value=value.note;
    box.appendChild(note);return box;
  }
  function renderChecks() {
    const parent=$('checksList');parent.replaceChildren();
    core.getChecks(category).forEach((c,index)=>{
      const root=el('section','check card'),top=el('div','check-top');
      top.appendChild(el('div','number',String(index+1).padStart(2,'0')));
      const copy=el('div','check-copy');
      const head=el('h3','',c.title);if(c.critical)head.appendChild(el('span','critical','ВАЖНО'));
      copy.append(head,el('p','tip',c.tip));top.appendChild(copy);root.appendChild(top);
      const grid=el('div','check-grid');grid.append(sellerCol(c),buyerCol(c));root.appendChild(grid);
      const a=sellerState[c.id].status,b=buyerState[c.id].status;
      if(a!=='unknown'&&b!=='unknown'&&a!==b)root.appendChild(el('div','compare-badge',(c.critical?'⚠ КРИТИЧЕСКОЕ РАСХОЖДЕНИЕ':'⚠ РАСХОЖДЕНИЕ')+' · отметки продавца и покупателя не совпали'));
      parent.appendChild(root);
    });
    $('sellerActions').hidden=!editable;
    renderSummary();
  }
  function renderSummary() {
    const checks=core.getChecks(category),a=core.summarize(sellerState,category),diff=core.compare(sellerState,buyerState,category),b=core.summarize(buyerState,category);
    $('statFilled').textContent=a.filled+'/'+a.total;
    $('statIssues').textContent=String(a.issue);
    $('statCompare').textContent=b.filled?String(diff.mismatches.length):'—';
    const title=$('resultTitle'),desc=$('resultText'),notes=$('resultNotes');notes.replaceChildren();
    if(a.criticalIssues.length){const names=a.criticalIssues.map(id=>checks.find(c=>c.id===id).title);notes.appendChild(el('span','note-pill critical-warn','Со слов продавца есть серьёзная проблема: '+names.join(', ')));}
    if(!passport&&!isDemo){title.textContent='Паспорт ещё не опубликован';desc.textContent='Продавец не добавил сведения о состоянии. Не воспринимайте это как подтверждение исправности.';return;}
    if(b.filled===0){title.textContent='Сравните сведения с реальным устройством';desc.textContent='Продавец заполнил '+a.filled+' из '+a.total+' пунктов. Заполните свою колонку при осмотре телефона.';return;}
    if(diff.criticalMismatches.length){title.textContent='Есть критические расхождения';desc.textContent='Заявления продавца и ваши результаты не совпали по важным пунктам. Не оплачивайте товар, пока причины не выяснены.';}
    else if(diff.buyerCriticalIssues.length||a.criticalIssues.length){title.textContent='Есть серьёзные замечания';desc.textContent='Проблемы отмечены продавцом или обнаружены вами. Не совершайте покупку, пока не выясните последствия и стоимость исправления.';}
    else if(diff.mismatches.length){title.textContent='Есть расхождения, нужны уточнения';desc.textContent='Совпало '+diff.matches+' пунктов, расхождений: '+diff.mismatches.length+'. Спросите продавца о причинах.';}
    else if(diff.unconfirmed.length){title.textContent='Часть результатов продавцом не подтверждена';desc.textContent='Совпавших пунктов: '+diff.matches+'. Ещё '+diff.unconfirmed.length+' вы проверили самостоятельно, но продавец их не оценил.';}
    else{title.textContent='По заполненным пунктам расхождений нет';desc.textContent='Совпавших пунктов: '+diff.matches+'. Это не гарантия качества: непроверенные пункты остаются неизвестными.';}
    diff.mismatches.forEach(id=>{
      const c=checks.find(x=>x.id===id);
      notes.appendChild(el('span','note-pill'+(c.critical?' critical-warn':''),'Не совпало: '+c.title));
    });
    diff.unconfirmed.forEach(id=>{
      const c=checks.find(x=>x.id===id);
      notes.appendChild(el('span','note-pill','Продавец не указал: '+c.title));
    });
  }
  function importVoltCheck() {
    const universal=safeSessionRead('voltcheck-universal-v1:'+category+':'+mockId);
    const legacy=category==='smartphone'?safeSessionRead(VOLTCHECK_KEY):null;
    const saved=universal&&universal.state?universal:legacy;
    if(!saved||!saved.state)return false;
    const incoming=saved===legacy?core.normalizeVoltCheck(saved):core.normalize(saved.state,category);
    let imported=false;
    core.getChecks(category).forEach(c=>{
      if(buyerState[c.id].status==='unknown'&&incoming[c.id].status!=='unknown'){
        buyerState[c.id]={status:incoming[c.id].status,note:incoming[c.id].note||buyerState[c.id].note};
        imported=true;
      }
    });
    if(imported){saveBuyer();notify('Отметки из VoltCheck перенесены в эту вкладку');}
    return imported;
  }
  function loadBuyer() {
    const cached=safeSessionRead(sessionKey());
    buyerState=core.normalize(cached,category);
    importVoltCheck();
  }
  window.addEventListener('pageshow',()=>{if(ad&&importVoltCheck())renderChecks();});
  function fillProduct() {
    $('productTitle').textContent=core.clean(ad?.model,80)||'Товар без названия';
    $('categoryName').textContent=core.getCategory(category).icon+' '+core.getCategory(category).label;
    $('productPrice').textContent=money(ad?.price);
    $('productCity').textContent=core.clean(ad?.city,70)||'Город не указан';
    $('productDate').textContent=passport?.updated_at?'Обновлён '+formatDate(passport.updated_at):'Паспорт ещё не опубликован';
    $('demoTag').hidden=!isDemo;
    const query=new URLSearchParams({ad:isDemo?mockId:ad.id,model:ad.model,price:String(ad.price||''),category});
    $('btnVoltcheck').onclick=()=>{location.href='voltcheck-all.html?'+query.toString();};
    const guide=$('openGuide');if(guide)guide.href='voltguide.html?'+query.toString();
  }
  function bindEvents() {
    $('checksList').addEventListener('click',event=>{
      const button=event.target.closest('button[data-key][data-status]');if(!button)return;
      const key=button.dataset.key,mode=button.dataset.mode,status=button.dataset.status;
      if(!core.getChecks(category).some(x=>x.id===key)||!Object.hasOwn(core.STATUS,status))return;
      if(mode==='seller'&&!editable)return;
      if(mode==='seller')sellerState[key].status=status;
      else{buyerState[key].status=status;saveBuyer();}
      renderChecks();
    });
    $('checksList').addEventListener('input',event=>{
      const input=event.target;if(!input.matches('textarea[data-key]'))return;
      const key=input.dataset.key;if(!core.getChecks(category).some(x=>x.id===key))return;
      const note=core.clean(input.value,180);
      if(input.name==='seller-note'&&editable)sellerState[key].note=note;
      if(input.name==='buyer-note'){buyerState[key].note=note;saveBuyer();}
    });
    $('savePassport').addEventListener('click',savePassport);
    $('copyLink').addEventListener('click',async()=>{
      if(isDemo){notify('Демо-паспорт нельзя выдавать за опубликованный');return;}
      try{await navigator.clipboard.writeText(location.href);notify('Ссылка скопирована');}
      catch(_){notify('Не удалось скопировать — скопируйте адрес из строки браузера');}
    });
    $('printPassport').addEventListener('click',()=>window.print());
    $('downloadReport').addEventListener('click',downloadReport);
    $('categorySelect').addEventListener('change',event=>switchCategory(event.target.value));
  }
  function downloadReport(){
    if(!ad)return;
    const output=core.report({model:ad.model,price:ad.price,category},sellerState,buyerState,new Date());
    const blob=new Blob([output],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download='VoltPassport-'+category+'-'+Date.now()+'.txt';
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function demoKey(){return 'voltpassport-demo-v2:'+mockId+':'+category;}
  function exampleAnswers(which){
    const examples={
      smartphone:{screen:{status:'ok'},activation:{status:'ok'},imei:{status:'unknown',note:'Проверьте самостоятельно в официальном сервисе.'},battery:{status:'issue',note:'Есть износ аккумулятора.'},history:{status:'issue',note:'Экран заменялся.'}},
      laptop:{account:{status:'unknown',note:'Пароль BIOS не проверен.'},display:{status:'ok'},power:{status:'ok'},battery:{status:'issue',note:'Автономность стала меньше.'}},
      furniture:{frame:{status:'ok'},pests:{status:'unknown'},mold:{status:'unknown'},upholstery:{status:'issue',note:'Есть небольшое пятно на сиденье.'},dimensions:{status:'ok',note:'190 × 85 × 80 см, со слов продавца.'}},
      bicycle:{frame:{status:'ok'},brakes:{status:'issue',note:'Нужна настройка заднего тормоза.'},wheels:{status:'ok'},chain:{status:'issue',note:'Цепь изношена.'}}
    };
    return examples[which]||{};
  }
  function switchCategory(next){
    if(!isDemo)return;
    const selected=core.resolveCategory(next);
    if(selected===category)return;
    sellerDrafts[category]=core.normalize(sellerState,category);
    category=selected;
    const c=core.getCategory(category);
    const saved=safeSessionRead(demoKey());
    passport=saved||{answers:exampleAnswers(category),updated_at:new Date().toISOString()};
    sellerState=sellerDrafts[category]||core.normalize(passport.answers,category);
    buyerState=core.normalize(safeSessionRead(sessionKey()),category);
    ad={id:mockId,model:c.example,price:0,city:'Демонстрация',status:'active'};
    const newUrl=new URL(location.href);newUrl.searchParams.set('category',category);history.replaceState(null,'',newUrl);
    $('categorySummary').textContent=c.subtitle;
    fillProduct();renderChecks();notify('Категория изменена: '+c.label);
  }
  async function savePassport() {
    if(pending||!editable)return;
    if(!isDemo&&!sb)return;
    const btn=$('savePassport');pending=true;btn.disabled=true;btn.textContent='Сохраняем…';
    try {
      const answers=core.normalize(sellerState,category);
      if(isDemo){passport={answers,updated_at:new Date().toISOString()};try{sessionStorage.setItem(demoKey(),JSON.stringify(passport));}catch(_){}notify('Демо-паспорт сохранён только в этой вкладке');}
      else {
        const query=passport
          ? sb.from('ad_passports').update({answers}).eq('ad_id',String(ad.id))
          : sb.from('ad_passports').insert({ad_id:String(ad.id),seller_id:user.id,answers,category:'smartphone'});
        const {data,error}=await query.select('answers,updated_at').single();
        if(error)throw error;passport=data;sellerState=core.normalize(data.answers,category);notify('Паспорт сохранён. Покупатели увидят сведения как заявления продавца.');
      }
      fillProduct();renderChecks();
    } catch(e){console.error('VoltPassport save:',e);notify('Не удалось сохранить паспорт. Проверьте подключение базы и права доступа.');}
    finally {pending=false;btn.disabled=false;btn.textContent='Сохранить паспорт';}
  }
  async function boot() {
    bindEvents();
    if(isDemo){
      const item=linkedMarketListing();
      if(item)category=item.category;
      const c=core.getCategory(category);
      ad=item?{id:item.id,model:item.title,price:item.price,city:item.city,status:'active'}
        :{id:mockId,model:core.clean(params.get('model'),80)||c.example,price:Number(params.get('price'))||0,city:'Демонстрация',status:'active'};
      const saved=safeSessionRead(demoKey());
      passport=item?{updated_at:new Date().toISOString(),answers:item.claims}:saved||{updated_at:new Date().toISOString(),answers:exampleAnswers(category)};
      editable=!item;sellerState=core.normalize(passport.answers,category);loadBuyer();
      $('categoryChooser').hidden=!!item;
      $('categorySelect').replaceChildren();
      core.CATEGORY_IDS.forEach(key=>{const option=el('option','',core.getCategory(key).icon+' '+core.getCategory(key).label);option.value=key;$('categorySelect').appendChild(option);});
      $('categorySelect').value=category;
      $('categorySummary').textContent=c.subtitle;
      setNotice(item?'ДЕМО · Сведения со слов условного продавца загружены из карточки VoltMarket. Это не экспертиза и не реальное опубликованное предложение.':'ДЕМО · Здесь показан учебный пример. Данные сохраняются только в этой вкладке и не связаны с реальными объявлениями.','warn');
      fillProduct();renderChecks();$('mainContent').hidden=false;return;
    }
    if(!adId){setNotice('Откройте паспорт из объявления VoltResale. Для изучения интерфейса доступен демонстрационный пример по ссылке ?demo=1.','warn');return;}
    const cfg=window.VOLT_CONFIG||{};
    if(!window.supabase||!cfg.supabaseUrl||!cfg.supabaseAnonKey){setNotice('Не удалось подключиться к VoltStore. Попробуйте позже.','error');return;}
    sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);
    try {
      const {data:auth}=await sb.auth.getUser();user=auth?.user||null;
      const {data:row,error:adErr}=await sb.from('ads').select('id,seller_id,model,price,city,status').eq('id',adId).maybeSingle();
      if(adErr)throw adErr;
      if(!row){setNotice('Объявление не найдено или недоступно. Вернитесь в VoltResale.','warn');return;}
      ad=row;editable=!!(user&&user.id===row.seller_id&&!['removed','sold'].includes(row.status));
      if(!editable&&!['active','reserved'].includes(row.status)){setNotice('Этот паспорт пока недоступен для просмотра.','warn');return;}
      const {data:p,error:pErr}=await sb.from('ad_passports').select('answers,updated_at').eq('ad_id',adId).maybeSingle();
      if(pErr){
        if(['42P01','PGRST205','PGRST204'].includes(pErr.code)||/not find.*ad_passports|does not exist/i.test(pErr.message||'')){
          setNotice('VoltPassport ещё не подключён к базе данных этого сайта. Данные не публикуются, пока не выполнена проверенная настройка.','warn');
        } else{throw pErr;}
        editable=false;
      } else {passport=p;setNotice(p?null:'Продавец пока не опубликовал паспорт. Указанные в объявлении характеристики не являются проверенной диагностикой.','warn');}
      sellerState=core.normalize(passport?.answers,category);loadBuyer();fillProduct();renderChecks();$('mainContent').hidden=false;
    } catch(e){console.error('VoltPassport load:',e);setNotice('Не удалось загрузить сведения. Попробуйте позже или вернитесь к объявлению.','error');}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
