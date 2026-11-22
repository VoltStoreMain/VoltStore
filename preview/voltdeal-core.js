/* VoltDeal v1 — pure demo transaction state machine.
   No server booking, no payments, no notification or verified identity. */
(function(root){
  'use strict';
  const STATES=Object.freeze({
    requested:'Заявка отправлена (демо)',
    accepted:'Условия подтверждены (демо)',
    inspected:'Осмотр отмечен покупателем',
    buyer_confirmed:'Покупатель подтвердил передачу',
    completed:'Обе стороны отметили передачу',
    declined:'Продавец отклонил заявку',
    cancelled:'Заявка отменена'
  });
  const EVENTS=Object.freeze({
    request:'Заявка создана покупателем',
    seller_accept:'Продавец подтвердил условия',
    seller_decline:'Продавец отклонил заявку',
    buyer_cancel:'Покупатель отменил заявку',
    seller_cancel:'Продавец отменил согласование',
    buyer_inspect:'Покупатель отметил результат осмотра',
    buyer_confirm:'Покупатель подтвердил передачу вещи',
    seller_confirm:'Продавец подтвердил передачу вещи'
  });
  const METHODS=Object.freeze({
    meetup:'Личная встреча в общественном месте',
    delivery_discussion:'Доставка — только по отдельной договорённости'
  });
  const WINDOWS=Object.freeze({
    flexible:'Договориться позже',
    weekday_day:'Будний день, днём',
    weekday_evening:'Будний день, вечером',
    weekend:'Выходные'
  });
  const TERMINAL=Object.freeze(['declined','cancelled','completed']);
  function clean(value,max=200){return String(value==null?'':value).replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);}
  function itemId(item){
    const id=clean(item&&item.id,100);
    return /^(?:demo|draft)-[A-Za-z0-9_-]{5,85}$/.test(id)?id:null;
  }
  function validObject(x){return !!x&&typeof x==='object'&&!Array.isArray(x);}
  function validMoment(now){return Number.isFinite(now)&&now>=1&&now<=32503680000000?Math.round(now):Date.now();}
  function create(item,terms,now){
    const id=itemId(item);
    if(!id)throw new Error('Неизвестный товар. Откройте его из VoltMarket.');
    if(!validObject(terms)||!Object.hasOwn(METHODS,terms.method)||!Object.hasOwn(WINDOWS,terms.window))
      throw new Error('Выберите допустимый способ и время получения.');
    const ts=validMoment(now);
    return {
      version:1, itemId:id, status:'requested',
      method:terms.method, window:terms.window,
      inspection:null,
      createdAt:ts,updatedAt:ts,
      history:[{event:'request',role:'buyer',ts}]
    };
  }
  function normalize(raw,id){
    if(!validObject(raw)||raw.version!==1||raw.itemId!==id||!itemId({id:raw.itemId})||
      !Object.hasOwn(STATES,raw.status)||!Object.hasOwn(METHODS,raw.method)||!Object.hasOwn(WINDOWS,raw.window))
      return null;
    if(!Array.isArray(raw.history)||raw.history.length<1||raw.history.length>25)return null;
    const history=raw.history.map(x=>{
      if(!validObject(x)||!Object.hasOwn(EVENTS,x.event)||!['buyer','seller'].includes(x.role)||!Number.isFinite(x.ts))return null;
      return {event:x.event,role:x.role,ts:validMoment(x.ts)};
    });
    if(history.some(x=>!x)||history[0].event!=='request'||history[0].role!=='buyer')return null;
    const inspection=validObject(raw.inspection)&&['ok','issue'].includes(raw.inspection.result)?
      {result:raw.inspection.result,confirmedByBuyer:raw.inspection.confirmedByBuyer===true,ts:validMoment(raw.inspection.ts)}:null;
    return {version:1,itemId:id,status:raw.status,method:raw.method,window:raw.window,
      inspection,createdAt:validMoment(raw.createdAt),updatedAt:validMoment(raw.updatedAt),history};
  }
  function actions(record,role){
    if(!record||!['buyer','seller'].includes(role))return [];
    const state=record.status;
    if(role==='buyer'){
      if(state==='requested')return ['buyer_cancel'];
      if(state==='accepted')return ['buyer_inspect','buyer_cancel'];
      if(state==='inspected')return ['buyer_confirm','buyer_cancel'];
      if(state==='buyer_confirmed')return ['buyer_cancel'];
    }else{
      if(state==='requested')return ['seller_accept','seller_decline'];
      if(['accepted','inspected','buyer_confirmed'].includes(state)){
        if(state==='buyer_confirmed')return ['seller_confirm','seller_cancel'];
        return ['seller_cancel'];
      }
    }
    return [];
  }
  function advance(raw,event,options,now){
    if(!raw||!actions(raw,event.startsWith('seller_')?'seller':'buyer').includes(event))
      throw new Error('Это действие недоступно на текущем этапе сделки.');
    const next={...raw,history:raw.history.slice(),inspection:raw.inspection&&{...raw.inspection}};
    if(next.history.length>=25)throw new Error('Демонстрационная история достигла ограничения.');
    if(event==='buyer_inspect'){
      if(!validObject(options)||options.personallyChecked!==true||!['ok','issue'].includes(options.result))
        throw new Error('Покупатель должен лично проверить товар и выбрать результат.');
      next.inspection={result:options.result,confirmedByBuyer:true,ts:validMoment(now)};
      next.status='inspected';
    }else if(event==='buyer_confirm'){
      if(!raw.inspection||raw.inspection.confirmedByBuyer!==true)
        throw new Error('Сначала отметьте личный осмотр товара.');
      if(raw.inspection.result==='issue'&&(!validObject(options)||options.acceptRisk!==true))
        throw new Error('Перед продолжением подтвердите, что знаете об отмеченных дефектах.');
      if(!validObject(options)||options.handoverConfirmed!==true)
        throw new Error('Подтверждение передачи доступно только после фактической передачи товара.');
      next.status='buyer_confirmed';
    }else{
      if(event==='seller_confirm'&&(!validObject(options)||options.handoverConfirmed!==true))
        throw new Error('Продавец должен подтвердить фактическую передачу вещи.');
      next.status={
        seller_accept:'accepted',seller_decline:'declined',buyer_cancel:'cancelled',
        seller_cancel:'cancelled',seller_confirm:'completed'
      }[event];
    }
    const role=event.startsWith('seller_')?'seller':'buyer';
    const ts=validMoment(now);
    next.updatedAt=ts;
    next.history.push({event,role,ts});
    return next;
  }
  function progress(record){
    if(!record)return 0;
    return {requested:1,accepted:2,inspected:3,buyer_confirmed:4,completed:5,
      cancelled:0,declined:0}[record.status]||0;
  }
  function nextStep(record,role){
    if(!record)return role==='buyer'?'Выберите способ получения и отправьте учебную заявку.':'Сначала отправьте заявку в роли покупателя.';
    if(TERMINAL.includes(record.status))return 'Сценарий завершён. Можно создать новую демонстрацию.';
    if(record.status==='requested')return role==='seller'?'Подтвердите или отклоните заявку.':'Ожидается решение продавца — переключитесь в его демо-роль.';
    if(record.status==='accepted')return role==='buyer'?'Проверьте товар лично через VoltCheck, затем отметьте результат.':'Покупатель должен осмотреть товар перед передачей.';
    if(record.status==='inspected')return role==='buyer'?'Подтвердите передачу только после фактического получения.':'Ожидается отметка покупателя о получении товара.';
    if(record.status==='buyer_confirmed')return role==='seller'?'Подтвердите передачу вещи, если она действительно состоялась.':'Ожидается отметка продавца о передаче.';
    return 'Сверьте статус сделки.';
  }
  const api=Object.freeze({STATES,EVENTS,METHODS,WINDOWS,TERMINAL,clean,create,normalize,actions,advance,progress,nextStep,itemId});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.VoltDealCore=api;
})(typeof window!=='undefined'?window:globalThis);
