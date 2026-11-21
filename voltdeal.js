/* VoltDeal UI — buyer and seller simulations in localStorage. NEVER a real booking/payment. */
(function(){
  'use strict';
  const core=window.VoltDealCore,market=window.VoltMarketCore,checks=window.VoltPassportCore;
  if(!core||!market)return;
  const $=id=>document.getElementById(id);
  const escape=s=>String(s==null?'':s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const params=new URLSearchParams(location.search),ad=params.get('ad')||'';
  let item=null,record=null,role='buyer',timer;
  function money(v){return Number(v).toLocaleString('ru-RU')+' ₸';}
  function tell(s){
    const el=$('toastDeal');el.textContent=s;el.hidden=false;clearTimeout(timer);
    timer=setTimeout(()=>{el.hidden=true;},3400);
  }
  function fromCatalog(){
    const ex=market.samples().find(x=>x.id===ad);
    if(ex)return ex;
    try{
      const list=JSON.parse(localStorage.getItem('voltmarket-local-drafts-v1')||'[]');
      if(!Array.isArray(list))return null;
      return list.slice(0,30).map(market.normalize).find(x=>x&&x.kind==='draft'&&x.id===ad)||null;
    }catch(_){return null;}
  }
  function key(){return 'voltdeal-demo-v1:'+item.id;}
  function load(){
    try{return core.normalize(JSON.parse(localStorage.getItem(key())||'null'),item.id);}
    catch(_){return null;}
  }
  function persist(next){
    try{
      if(next===null)localStorage.removeItem(key());
      else localStorage.setItem(key(),JSON.stringify(next));
      record=next;return true;
    }catch(_){
      tell('Локальное хранилище недоступно. Действие не сохранено.');
      return false;
    }
  }
  function goto(href){location.href=href;}
  function inspectionContext(){
    if(!checks)return null;
    const key='voltcheck-universal-v1:'+item.category+':'+item.id;
    let data=null;
    try{data=JSON.parse(sessionStorage.getItem(key)||'null');}catch(_){}
    if(!data||!data.state)return null;
    return checks.summarize(data.state,item.category);
  }
  function init(){
    item=fromCatalog();
    if(!item){
      $('missingItem').hidden=false;$('dealContent').hidden=true;
      $('examples').innerHTML=market.samples().slice(0,6).map(x=>'<a class="example-card" href="voltdeal.html?ad='+encodeURIComponent(x.id)+'"><span>'+market.category(x.category).icon+'</span><div><strong>'+escape(x.title)+'</strong><small>Тестовая покупка · '+money(x.price)+'</small></div></a>').join('');
      $('backItem').href='market.html';return;
    }
    record=load();
    $('dealContent').hidden=false;
    $('missingItem').hidden=true;
    $('backItem').href=market.link(item,'item');
    document.title=item.title+' — VoltDeal (демо)';
    const c=market.category(item.category);
    $('itemSummary').innerHTML='<div class="item-symbol" aria-hidden="true">'+c.icon+'</div>'+
      '<div class="item-heading"><span class="label">'+escape(c.name)+' · '+(item.kind==='draft'?'МОЙ ЧЕРНОВИК':'ДЕМО-ПРИМЕР')+'</span>'+
      '<h2>'+escape(item.title)+'</h2><p>'+escape(item.city)+' · '+escape(item.condition)+' · Не опубликованная реальная сделка</p></div>'+
      '<div class="item-price">'+money(item.price)+'</div>';
    $('passportLink').href=market.link(item,'passport');
    $('guideLink').href=market.link(item,'guide');
    $('checkLink').href=market.link(item,'check');
    $('roles').addEventListener('click',e=>{
      const button=e.target.closest('[data-role]');if(!button)return;
      role=button.dataset.role==='seller'?'seller':'buyer';render();
    });
    $('actionContent').addEventListener('submit',submit);
    $('actionContent').addEventListener('click',e=>{
      const b=e.target.closest('[data-event]');if(b)handleEvent(b.dataset.event);
    });
    $('resetScenario').addEventListener('click',()=>{
      if(!confirm('Начать новую учебную сделку? Локальная история этого товара исчезнет.'))return;
      if(persist(null)){role='buyer';render();tell('История демонстрации очищена.');}
    });
    $('downloadReceipt').addEventListener('click',download);
    window.addEventListener('storage',e=>{
      if(e.key===key()){record=load();render();tell('Учебная сделка обновлена в другой вкладке.');}
    });
    window.addEventListener('pageshow',()=>{record=load();render();});
    render();
  }
  function render(){
    $('roles').querySelectorAll('[data-role]').forEach(button=>{
      const on=button.dataset.role===role;button.classList.toggle('active',on);button.setAttribute('aria-pressed',String(on));
    });
    const n=core.progress(record);
    const stepLabels=['Заявка','Согласование','Осмотр','Получение','Готово'];
    $('progress').innerHTML=stepLabels.map((text,i)=>{
      const done=!!record&&!core.TERMINAL.includes(record.status)&&n>i+1;
      const current=!!record&&!core.TERMINAL.includes(record.status)&&n===i+1 || record?.status==='completed'&&i===4;
      return '<div class="deal-progress-step'+(done||record?.status==='completed'?' done':'')+(current?' current':'')+'"><strong>'+(i+1)+'</strong><small>'+text+'</small></div>';
    }).join('');
    const state=record?core.STATES[record.status]:'Заявка ещё не создана';
    $('statusBox').innerHTML='<div class="status-name">СОСТОЯНИЕ / '+(role==='buyer'?'ПОКУПАТЕЛЬ':'ПРОДАВЕЦ')+'</div>'+
      '<h3>'+escape(state)+'</h3><p>'+escape(core.nextStep(record,role))+'</p>';
    $('actionContent').innerHTML=renderActions();
    $('resetArea').hidden=!record;
    renderInspectionInfo();
    renderHistory();
  }
  function renderActions(){
    if(!record){
      if(role==='seller')return '<div class="info">Для демонстрации сначала переключись в роль покупателя и отправь заявку. В настоящем продукте продавец увидит только заявки к своим товарам.</div>';
      return '<h3>Отправить заявку на покупку</h3>'+
        '<p>Это не покупка и не реальное бронирование. Продавец не получит уведомление. Условия нужны для демонстрации процесса.</p>'+
        '<form id="requestForm"><label>Способ получения<select name="method" required>'+
        Object.entries(core.METHODS).map(([key,text])=>'<option value="'+key+'">'+escape(text)+'</option>').join('')+
        '</select></label><label>Предпочитаемое время<select name="window" required>'+
        Object.entries(core.WINDOWS).map(([key,text])=>'<option value="'+key+'">'+escape(text)+'</option>').join('')+
        '</select></label><label class="tick"><input name="understood" type="checkbox" required>'+
        '<span>Понимаю: заявка не резервирует вещь, не отправляется продавцу и не инициирует оплату.</span></label>'+
        '<button type="submit" class="primary">Отправить заявку (демо) →</button></form>';
    }
    let info='<div class="info"><strong>Предпочтение:</strong> '+escape(core.METHODS[record.method])+
      '<br><strong>Время:</strong> '+escape(core.WINDOWS[record.window])+'. Детали встречи и контакты здесь не собираются.</div>';
    if(core.TERMINAL.includes(record.status)){
      return info+'<p class="safe">'+(record.status==='completed'
        ?'В этом браузере покупатель и продавец отметили передачу. Это не подтверждение оплаты, личности или фактического получения.'
        :record.status==='declined'?'Учебная заявка отклонена продавцом. Деньги не списывались.':'Учебная заявка отменена. Деньги не списывались.')+'</p>';
    }
    if(role==='seller'){
      if(record.status==='requested')return info+'<h3>Решение продавца</h3>'+
        '<p>При подтверждении здесь меняется только состояние демо. Товар не блокируется от других покупок.</p>'+
        '<div class="button-row"><button type="button" class="primary" data-event="seller_accept">Подтвердить условия</button>'+
        '<button type="button" class="outline" data-event="seller_decline">Отклонить заявку</button></div>';
      if(record.status==='buyer_confirmed')return info+'<h3>Подтверждение передачи продавцом</h3>'+
        '<p>Покупатель уже отметил передачу. Только после реального вручения можно отмечать её со стороны продавца.</p>'+
        '<form id="sellerFinishForm"><label class="tick"><input type="checkbox" name="handover" required>'+
        '<span>Подтверждаю в демонстрационном сценарии, что вещь передана покупателю. Это не подтверждение оплаты.</span></label>'+
        '<div class="button-row"><button type="submit" class="primary">Подтвердить передачу</button>'+
        '<button type="button" class="outline" data-event="seller_cancel">Отменить согласование</button></div></form>';
      return info+'<p>Ожидается действие покупателя: осмотр и подтверждение получения.</p>'+
        '<button type="button" class="outline" data-event="seller_cancel">Отменить согласование</button>';
    }
    // Buyer persona: no server authorization involved.
    if(record.status==='requested')return info+'<p>Продавец ещё не подтвердил условия. Переключись в учебную роль продавца, чтобы пройти следующий этап.</p>'+
      '<button type="button" class="outline" data-event="buyer_cancel">Отменить заявку</button>';
    if(record.status==='accepted')return info+
      '<h3>Осмотри вещь перед получением</h3>'+
      '<p>Открой VoltCheck для этого товара, отметь дефекты и выбери результат. Никаких автоматических гарантий.</p>'+
      '<p><a class="outline" href="'+escape(market.link(item,'check'))+'">🛡️ Открыть VoltCheck ↗</a></p>'+
      '<form id="inspectionForm"><label>Мой результат осмотра<select name="result" required>'+
      '<option value="">Выбери результат</option><option value="ok">Серьёзных проблем не заметил (по моей оценке)</option>'+
      '<option value="issue">Обнаружены дефекты или сомнения</option></select></label>'+
      '<label class="tick"><input type="checkbox" name="checked" required>'+
      '<span>Я лично осмотрел товар. Понимаю, что мои отметки не заменяют экспертизу.</span></label>'+
      '<div class="button-row"><button type="submit" class="primary">Зафиксировать осмотр</button>'+
      '<button type="button" class="outline" data-event="buyer_cancel">Отменить заявку</button></div></form>';
    if(record.status==='inspected')return info+
      (record.inspection?.result==='issue'?'<div class="risk"><strong>Обнаружены дефекты.</strong> Прежде чем продолжить, выясни их последствия и стоимость ремонта. Можно отказаться от сделки.</div>':'<div class="safe">По твоим отметкам серьёзные дефекты не выявлены. Это не гарантия исправности.</div>')+
      '<h3>Получил товар?</h3><p>Не подтверждай передачу заранее или только ради перехода к следующему шагу.</p>'+
      '<form id="buyerFinishForm">'+
      (record.inspection?.result==='issue'?'<label class="tick"><input type="checkbox" name="risk" required><span>Я понимаю последствия обнаруженных дефектов и всё равно хочу продолжить демонстрацию.</span></label>':'')+
      '<label class="tick"><input type="checkbox" name="handover" required><span>Отмечаю, что предмет мне передан в учебном сценарии. Это не подтверждение оплаты.</span></label>'+
      '<div class="button-row"><button type="submit" class="primary">Подтвердить получение</button><button type="button" class="outline" data-event="buyer_cancel">Отменить заявку</button></div></form>';
    if(record.status==='buyer_confirmed')return info+
      '<p>Ожидаем подтверждение продавца о передаче вещи. Только после этого учебный сценарий завершится.</p>'+
      '<button type="button" class="outline" data-event="buyer_cancel">Отменить заявку</button>';
    return info;
  }
  function submit(event){
    event.preventDefault();
    const form=event.target;
    if(!form.checkValidity()){form.reportValidity();return;}
    try{
      if(form.id==='requestForm'){
        if(role!=='buyer')throw Error('Только покупатель может отправить заявку.');
        if(record)throw Error('Для новой сделки сначала сбросьте прошлую демонстрацию.');
        if(!form.elements.understood.checked)throw Error('Подтвердите учебный характер заявки.');
        const next=core.create(item,{method:form.elements.method.value,window:form.elements.window.value});
        if(persist(next)){render();tell('Учебная заявка создана. Переключитесь в роль продавца.');}
      }else if(form.id==='inspectionForm'){
        if(role!=='buyer')throw Error('Только покупатель отмечает осмотр.');
        if(!form.elements.checked.checked)throw Error('Сначала осмотрите товар.');
        const stats=inspectionContext();
        if(stats&&stats.criticalIssues.length>0&&form.elements.result.value==='ok')
          throw Error('В VoltCheck отмечены критические дефекты. Отразите проблему в результате осмотра.');
        const next=core.advance(record,'buyer_inspect',{personallyChecked:true,result:form.elements.result.value});
        if(persist(next)){render();tell('Результат осмотра сохранён локально.');}
      }else if(form.id==='buyerFinishForm'){
        if(role!=='buyer')throw Error('Это действие выполняет покупатель.');
        const next=core.advance(record,'buyer_confirm',{
          handoverConfirmed:form.elements.handover.checked,
          acceptRisk:record?.inspection?.result==='issue'&&form.elements.risk?.checked===true
        });
        if(persist(next)){render();tell('Получение отмечено. Ожидается продавец.');}
      }else if(form.id==='sellerFinishForm'){
        if(role!=='seller')throw Error('Это действие выполняет продавец.');
        const next=core.advance(record,'seller_confirm',{handoverConfirmed:form.elements.handover.checked});
        if(persist(next)){render();tell('Демонстрационный сценарий завершён.');}
      }
    }catch(err){tell(core.clean(err.message,240));}
  }
  function handleEvent(event){
    const allowed=core.actions(record,role);
    if(!allowed.includes(event)){tell('Действие уже недоступно или принадлежит другой роли.');return;}
    if(['buyer_cancel','seller_cancel','seller_decline'].includes(event) &&
      !confirm('Подтвердить это действие в учебной заявке?'))return;
    try{
      const next=core.advance(record,event);
      if(persist(next)){render();tell('Статус учебной сделки обновлён.');}
    }catch(e){tell(core.clean(e.message,240));}
  }
  function renderInspectionInfo(){
    const stats=inspectionContext();
    const el=$('inspectionInfo');
    if(!stats){
      el.textContent='Проверок VoltCheck для этой позиции пока нет. Заполните чек-лист и вернитесь сюда в эту же вкладку браузера.';
    }else{
      el.textContent='Ваш VoltCheck: отмечено '+stats.filled+' из '+stats.total+' пунктов; проблем '+stats.issue+
        '; критических '+stats.criticalIssues.length+'. Отметки принадлежат пользователю и никем не сертифицированы.';
    }
  }
  function renderHistory(){
    const div=$('history');
    if(!record){
      div.innerHTML='<div class="fine">История пуста. После создания демо-заявки здесь появятся этапы.</div>';return;
    }
    div.innerHTML=record.history.map(x=>'<div class="history-item"><span class="history-dot"></span>'+
      '<div><strong>'+escape(core.EVENTS[x.event])+'</strong><span>'+escape(new Date(x.ts).toLocaleString('ru-RU'))+
      ' · '+(x.role==='buyer'?'Покупатель':'Продавец')+' (демо)</span></div></div>').join('');
  }
  function download(){
    if(!item)return;
    const lines=['VOLTDEAL / ДЕМОНСТРАЦИОННАЯ ПАМЯТКА','Это НЕ чек, НЕ договор, НЕ подтверждение оплаты/брони или фактической передачи.',
      'Товар (пример): '+item.title,'Категория: '+market.category(item.category).name,
      'Показанная цена: '+money(item.price),
      'Статус: '+(record?core.STATES[record.status]:'заявки нет'),
      'Предложенный формат: '+(record?core.METHODS[record.method]:'не выбран'),
      'Время: '+(record?core.WINDOWS[record.window]:'не выбрано'),
      'Мои проверки VoltCheck: '+(inspectionContext()?
        inspectionContext().filled+' из '+inspectionContext().total:'отсутствуют'),
      '','Что проверить до оплаты: состояние по VoltCheck, происхождение, комплект и заявленные дефекты.',
      'Не отправлять предоплату незнакомым лицам и не передавать пароли/банковские реквизиты.',
      '','История действий учебного симулятора:'];
    if(record)record.history.forEach(x=>lines.push(new Date(x.ts).toLocaleString('ru-RU')+' — '+core.EVENTS[x.event]));
    const blob=new Blob([lines.join('\n')],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download='VoltDeal-demo-'+item.category+'.txt';
    document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
  }
  init();
})();