/* VoltMarket Beta UX — sample catalog + browser-local seller drafts. No backend publishing. */
(function(){
  'use strict';
  const core=window.VoltMarketCore,passport=window.VoltPassportCore;
  if(!core)return;
  const $=id=>document.getElementById(id),esc=value=>String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const storage='voltmarket-local-drafts-v1';
  let drafts=[],selected='all',filter={q:'',category:'all',city:'',condition:'',maxPrice:'',sort:'newest',attribute:'',attributeValue:''};
  let selectedItem=null,toastTimer;
  function notify(s){
    const t=$('notice');t.textContent=s;t.hidden=false;
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.hidden=true,3400);
  }
  function price(value){return Number(value).toLocaleString('ru-RU')+' ₸';}
  function fromDisk(){
    try{
      const saved=JSON.parse(localStorage.getItem(storage)||'[]');
      if(!Array.isArray(saved))return [];
      const ids=new Set();
      return saved.slice(0,30).map(core.normalize).filter(x=>{
        if(!x||x.kind!=='draft'||ids.has(x.id))return false;
        ids.add(x.id);return true;
      });
    }catch(_){return [];}
  }
  function saveDisk(){
    try{localStorage.setItem(storage,JSON.stringify(drafts));return true;}
    catch(_){notify('Не удалось сохранить черновик в браузере. Возможно, хранилище отключено или переполнено.');return false;}
  }
  function all(){return core.samples().concat(drafts);}
  function route(){
    let hash='';try{hash=decodeURIComponent(location.hash.slice(1));}catch(_){return 'list';}
    if(hash==='draft')return 'draft';
    if(hash.startsWith('item/'))return 'item';
    return 'list';
  }
  function goto(hash){location.hash=hash;renderRoute();window.scrollTo({top:0,behavior:'instant'});}
  function renderRoute(){
    const target=route();
    let id=null;if(target==='item'){try{id=decodeURIComponent(location.hash.slice('#item/'.length));}catch(_){id=null;}}
    selectedItem=id?all().find(x=>x.id===id):null;
    const view=target==='item'&&selectedItem?'detail':target==='draft'?'draft':'list';
    document.body.dataset.view=view;
    $('detailView').hidden=view!=='detail';
    $('draftView').hidden=view!=='draft';
    $('discover').hidden=view!=='list';
    if(view==='detail')renderDetail(selectedItem);
    else if(view==='draft')renderForm();
    else renderCatalog();
    document.title=view==='detail'?selectedItem.title+' — VoltMarket (демо)':view==='draft'?'Черновик объявления — VoltMarket':'VoltMarket Beta — товары и проверка | VoltStore';
  }
  function tabs(){
    const ids=['all'].concat(core.CATEGORY_IDS);
    $('categoryTabs').innerHTML=ids.map(id=>{
      const cat=id==='all'?{icon:'◈',name:'Все товары'}:core.CATEGORIES[id];
      return '<button type="button" class="category-button'+(selected===id?' selected':'')+'" data-category="'+esc(id)+'" aria-pressed="'+(selected===id)+'"><span aria-hidden="true">'+cat.icon+'</span>'+esc(cat.name)+'</button>';
    }).join('');
  }
  function addCities(){
    const options=Array.from(new Set(all().map(x=>x.city))).sort((a,b)=>a.localeCompare(b,'ru'));
    $('city').innerHTML='<option value="">Все города</option>'+options.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');
    $('city').value=options.includes(filter.city)?filter.city:'';
  }
  function attributePicker(){
    const wrap=$('attributeFilterWrap'),input=$('attributeFilter');
    if(selected==='all'){wrap.hidden=true;filter.attribute='';filter.attributeValue='';return;}
    const schema=core.category(selected),f=schema.fields.find(x=>x.type==='select');
    if(!f){wrap.hidden=true;return;}
    wrap.hidden=false;wrap.firstChild.textContent=f.label;
    filter.attribute=f.id;
    input.innerHTML='<option value="">Все значения</option>'+f.options.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');
    input.value=f.options.includes(filter.attributeValue)?filter.attributeValue:'';
    filter.attributeValue=input.value;
  }
  function renderCatalog(){
    tabs();addCities();attributePicker();
    $('search').value=filter.q;$('condition').value=filter.condition;
    $('maxPrice').value=filter.maxPrice;$('sort').value=filter.sort;
    const items=core.filter(all(),filter);
    const grid=$('listingGrid');
    $('resultCount').textContent='Найдено: '+items.length+' · примеры и мои локальные черновики';
    grid.innerHTML=items.length?items.map(item=>{
      const cat=core.category(item.category);
      const chips=cat.fields.map(f=>item.attrs[f.id]!==undefined?'<span class="chip">'+esc(String(item.attrs[f.id]))+'</span>':'').filter(Boolean).slice(0,2).join('');
      return '<article class="listing">'+
        '<div class="illustration '+esc(item.category)+'"><span class="image-tag">'+(item.kind==='draft'?'МОЙ ЧЕРНОВИК':'ДЕМО-ПРИМЕР')+'</span><span aria-hidden="true">'+cat.icon+'</span></div>'+
        '<div class="listing-copy"><span class="category-label">'+esc(cat.name)+' · '+esc(item.city)+'</span><h3>'+esc(item.title)+'</h3>'+
        '<div class="chips"><span class="chip">'+esc(item.condition)+'</span>'+chips+'</div><div class="price">'+price(item.price)+'</div>'+
        '<div class="meta">'+(item.kind==='draft'?'Никому не опубликовано':'Цена и товар — демонстрационные')+'</div>'+
        '<button class="view" type="button" data-open="'+esc(item.id)+'">Изучить товар →</button></div></article>';
    }).join(''):'<div class="empty">По заданным фильтрам нет товаров.<br><button class="outline" type="button" data-reset="1">Сбросить фильтры</button></div>';
  }
  function chooseCategory(cat){
    if(cat!=='all'&&!core.CATEGORY_IDS.includes(cat))return;
    selected=cat;filter.category=cat;filter.attribute='';filter.attributeValue='';
    renderCatalog();
  }
  function renderForm(){
    const select=$('formCategory');
    if(!select.options.length){
      select.innerHTML=core.CATEGORY_IDS.map(id=>'<option value="'+esc(id)+'">'+core.category(id).icon+' '+esc(core.category(id).name)+'</option>').join('');
      $('formCondition').innerHTML=core.CONDITIONS.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');
    }
    if(!core.CATEGORY_IDS.includes(select.value))select.value='smartphone';
    dynamicFields();
  }
  function dynamicFields(){
    const cat=core.category($('formCategory').value);
    $('dynamicFields').innerHTML=cat.fields.map(f=>{
      if(f.type==='select')
        return '<label>'+esc(f.label)+'<select data-attr="'+esc(f.id)+'"><option value="">Не указано</option>'+f.options.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('')+'</select></label>';
      return '<label>'+esc(f.label)+'<input data-attr="'+esc(f.id)+'" type="number" min="'+f.min+'" max="'+f.max+'" inputmode="numeric" placeholder="Необязательно"></label>';
    }).join('');
  }
  function saveDraft(event){
    event.preventDefault();
    if(drafts.length>=30){$('formMessage').textContent='Ограничение демо: максимум 30 черновиков. Удали старые перед созданием новых.';return;}
    const attrs=Object.create(null);
    $('dynamicFields').querySelectorAll('[data-attr]').forEach(x=>attrs[x.dataset.attr]=x.value);
    const id='draft-'+(globalThis.crypto&&crypto.randomUUID?crypto.randomUUID().replace(/-/g,'').slice(0,16):String(Date.now())+String(Math.floor(Math.random()*100000)));
    const normalized=core.normalize({id,kind:'draft',category:$('formCategory').value,title:$('formTitle').value,
      price:$('formPrice').value,city:$('formCity').value,condition:$('formCondition').value,
      note:$('formNote').value,attrs,claims:{},created:Date.now()});
    if(!normalized){$('formMessage').textContent='Проверь название, цену, категорию и город.';return;}
    drafts.unshift(normalized);
    if(!saveDisk()){drafts.shift();return;}
    $('draftForm').reset();$('formMessage').textContent='';
    notify('Черновик сохранён только в этом браузере — не опубликован.');
    goto('#item/'+encodeURIComponent(normalized.id));
  }
  function getClaims(item){
    if(!passport||typeof passport.getChecks!=='function')return [];
    return passport.getChecks(item.category).map(x=>({title:x.title,status:item.claims[x.id]||'unknown',critical:!!x.critical}));
  }
  function renderDetail(item){
    const c=core.category(item.category),isDraft=item.kind==='draft';
    const attrs=c.fields.filter(x=>item.attrs[x.id]!==undefined);
    const claims=getClaims(item);
    const statement=claims.map(x=>{
      const status=x.status==='issue'?'Заявлен дефект':x.status==='ok'?'Со слов продавца: исправно':'Не указано / не проверено';
      return '<div class="claim"><small>'+esc(x.title)+(x.critical?' · важно':'')+'</small><b class="'+esc(x.status)+'">'+esc(status)+'</b></div>';
    }).join('');
    const guide=core.link(item,'guide'),check=core.link(item,'check'),demoPassport=core.link(item,'passport');
    const sellerEditor=isDraft?'<section class="panel" id="draftClaimsEditor"><span class="eyebrow">МОЙ ЛОКАЛЬНЫЙ ПАСПОРТ</span><h2>Отметки владельца черновика</h2>'+
      '<p>Это ваш учебный черновик, не опубликованное удостоверение состояния. Выберите по каждому пункту честный статус. Данные останутся только в браузере.</p>'+
      '<div class="claims">'+passport.getChecks(item.category).map(x=>'<label class="claim"><small>'+esc(x.title)+(x.critical?' · важно':'')+'</small><select data-draft-claim="'+esc(x.id)+'">'+
        [['unknown','Не знаю / не проверял'],['ok','Со слов владельца: исправно'],['issue','Известен дефект']].map(pair=>'<option value="'+pair[0]+'"'+((item.claims[x.id]||'unknown')===pair[0]?' selected':'')+'>'+pair[1]+'</option>').join('')+
      '</select></label>').join('')+'</div><button type="button" class="primary" id="saveDraftClaims">Сохранить отметки только здесь</button></section>':'';
    $('detailContent').innerHTML=
      '<div class="detail-heading"><div><span class="eyebrow">'+esc(c.name)+' / '+(isDraft?'МОЙ ЧЕРНОВИК':'ДЕМОНСТРАЦИОННЫЙ ПРИМЕР')+'</span><h1 id="detailTitle">'+esc(item.title)+'</h1><p class="fine">📍 '+esc(item.city)+' · '+esc(item.condition)+'</p></div><div class="big-price">'+price(item.price)+'</div></div>'+
      '<div class="detail-summary"><section class="panel"><div class="detail-visual" aria-hidden="true">'+c.icon+'</div><h2>Характеристики и описание</h2><p>'+esc(item.note||'Описание пока не заполнено. Не считай отсутствие описания признаком исправности.')+'</p>'+
      '<div class="specs">'+attrs.map(f=>'<div class="spec"><small>'+esc(f.label)+'</small><b>'+esc(String(item.attrs[f.id]))+'</b></div>').join('')+
      '<div class="spec"><small>Заявленное состояние</small><b>'+esc(item.condition)+'</b></div><div class="spec"><small>Город</small><b>'+esc(item.city)+'</b></div></div></section>'+
      '<aside class="panel"><h2>Сначала факты, потом решение</h2><div class="trust-status"><span>!</span><span><strong>Не сертифицировано VoltStore.</strong><br>Это '+(isDraft?'локальный черновик':'вымышленный пример')+'. Заявления о состоянии не проверены независимым специалистом. Никакие деньги не принимаются.</span></div>'+
      '<p>Начни с описания. Если что-то неясно, уточни у продавца или проведи самостоятельную проверку.</p>'+
      '<a class="outline" href="'+esc(guide)+'">✦ Спросить VoltGuide</a></aside></div>'+
      '<section class="panel"><span class="eyebrow">02 / СВЕДЕНИЯ О СОСТОЯНИИ</span><h2>Что известно со слов продавца?</h2>'+
      '<p>Незаполненные пункты — не подтверждение исправности. Это сведения со слов условного продавца или владельца локального черновика, а не независимая экспертиза.</p>'+
      '<div class="claims">'+statement+'</div>'+
      '<a class="outline" href="'+esc(demoPassport)+'">📋 Открыть пример VoltPassport ↗</a>'+
      '<p class="fine">VoltPassport показывает ваши тестовые данные по выбранной позиции. Это не подтверждённый сертификат состояния товара.</p></section>'+sellerEditor+
      '<section class="journey" aria-label="Инструменты проверки">'+
      '<div class="journey-card"><span class="number">03 / РАЗОБРАТЬСЯ</span><h3>✦ VoltGuide</h3><p>Поможет составить вопросы продавцу на основе категории, модели и твоих отметок.</p><a href="'+esc(guide)+'">Получить рекомендации ↗</a></div>'+
      '<div class="journey-card"><span class="number">04 / ПРОВЕРИТЬ ЛИЧНО</span><h3>🛡 VoltCheck</h3><p>Отметь работающие функции, скрытые дефекты и непроверенные пункты по чек-листу.</p><a href="'+esc(check)+'">Начать осмотр ↗</a></div>'+
      '<div class="journey-card"><span class="number">05 / ПРИНЯТЬ РЕШЕНИЕ</span><h3>✓ Мой следующий шаг</h3><p>Зафиксируй, что решил после изучения. Никакой оплаты или бронирования здесь нет.</p><a href="#decisionPanel" data-decision="1">Перейти к решению ↓</a></div></section>'+
      '<section class="panel decision" id="decisionPanel"><div><h2>Мой вывод</h2><p class="fine">Это личная заметка, она не отправляется продавцу. Сохрани себе план действий до встречи.</p>'+
      '<select id="decisionSelect" aria-label="Моё решение"><option value="questions">Остались вопросы продавцу</option><option value="inspect">Хочу проверить товар при встрече</option><option value="decline">Решил отказаться от предложения</option></select></div>'+
      '<button class="primary" type="button" id="downloadPlan">Скачать план .txt</button></section>'+
      (isDraft?'<button class="subtle" type="button" id="deleteDraft">Удалить этот локальный черновик</button>':'');
    const itemKey='voltmarket-decision:'+item.id;
    try{const saved=sessionStorage.getItem(itemKey);if(['questions','inspect','decline'].includes(saved))$('decisionSelect').value=saved;}catch(_){}
    $('decisionSelect').addEventListener('change',()=>{try{sessionStorage.setItem(itemKey,$('decisionSelect').value);}catch(_){}});
    $('downloadPlan').addEventListener('click',()=>downloadPlan(item));
    if(isDraft){
      $('deleteDraft').addEventListener('click',()=>removeDraft(item.id));
      $('saveDraftClaims').addEventListener('click',()=>saveDraftClaims(item.id));
    }
  }
  function saveDraftClaims(id){
    const index=drafts.findIndex(x=>x.id===id);
    if(index<0)return notify('Черновик не найден в этом браузере.');
    const claims=Object.create(null);
    $('draftClaimsEditor').querySelectorAll('select[data-draft-claim]').forEach(el=>{
      const status=el.value;if(['ok','issue','unknown'].includes(status))claims[el.dataset.draftClaim]=status;
    });
    const updated=core.normalize({...drafts[index],claims});
    if(!updated)return notify('Не удалось сохранить паспорт. Проверьте заполненные данные.');
    const old=drafts[index];drafts[index]=updated;
    if(!saveDisk()){drafts[index]=old;return;}
    selectedItem=updated;renderDetail(updated);
    notify('Отметки продавца сохранены в локальном черновике.');
  }
  function downloadPlan(item){
    const choice=$('decisionSelect').value;
    const decision={questions:'Остались вопросы продавцу',inspect:'Хочу проверить товар лично',decline:'Решил отказаться'}[choice]||'Не указано';
    const lines=['VOLTMARKET · ЛИЧНЫЙ ПЛАН ПОКУПАТЕЛЯ','Демонстрационный инструмент — не гарантия сделки',
      'Дата: '+new Date().toLocaleString('ru-RU'),'Товар: '+item.title,
      'Категория: '+core.category(item.category).name,'Цена из демонстрации: '+price(item.price),
      'Решение: '+decision,'','До оплаты: проверить состояние, документы и происхождение товара, не переводить предоплату незнакомому продавцу.',
      'Инструменты VoltStore: VoltGuide и VoltCheck (самостоятельная проверка).','Это не результат экспертизы и не подтверждение продавца.'];
    const blob=new Blob([lines.join('\n')],{type:'text/plain;charset=utf-8'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='VoltMarket-plan-'+item.category+'.txt';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
  }
  function removeDraft(id){
    if(!confirm('Удалить черновик только из этого браузера?'))return;
    drafts=drafts.filter(x=>x.id!==id);
    if(!saveDisk())return;
    notify('Локальный черновик удалён.');goto('#discover');
  }
  function init(){
    drafts=fromDisk();
    $('condition').innerHTML='<option value="">Любое состояние</option>'+core.CONDITIONS.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');
    $('categoryTabs').addEventListener('click',e=>{const b=e.target.closest('[data-category]');if(b)chooseCategory(b.dataset.category);});
    $('listingGrid').addEventListener('click',e=>{const b=e.target.closest('[data-open]');if(b)goto('#item/'+encodeURIComponent(b.dataset.open));if(e.target.closest('[data-reset]'))resetFilters();});
    $('heroExplore').addEventListener('click',()=>$('discover').scrollIntoView({behavior:'smooth'}));
    $('heroDraft').addEventListener('click',()=>goto('#draft'));
    $('backToResults').addEventListener('click',()=>goto('#discover'));
    $('backFromDraft').addEventListener('click',()=>goto('#discover'));
    $('resetFilters').addEventListener('click',resetFilters);
    $('detailContent').addEventListener('click',e=>{const jump=e.target.closest('[data-decision]');if(jump){e.preventDefault();$('decisionPanel')?.scrollIntoView({behavior:'smooth'});}});
    $('search').addEventListener('input',e=>{filter.q=e.target.value;renderCatalog();});
    $('city').addEventListener('change',e=>{filter.city=e.target.value;renderCatalog();});
    $('condition').addEventListener('change',e=>{filter.condition=e.target.value;renderCatalog();});
    $('maxPrice').addEventListener('change',e=>{filter.maxPrice=e.target.value;renderCatalog();});
    $('sort').addEventListener('change',e=>{filter.sort=e.target.value;renderCatalog();});
    $('attributeFilter').addEventListener('change',e=>{filter.attributeValue=e.target.value;renderCatalog();});
    $('formCategory').addEventListener('change',dynamicFields);
    $('draftForm').addEventListener('submit',saveDraft);
    $('draftForm').addEventListener('reset',()=>{setTimeout(dynamicFields,0);$('formMessage').textContent='';});
    window.addEventListener('hashchange',renderRoute);
    renderRoute();
  }
  function resetFilters(){
    selected='all';filter={q:'',category:'all',city:'',condition:'',maxPrice:'',sort:'newest',attribute:'',attributeValue:''};
    renderCatalog();
  }
  init();
})();
