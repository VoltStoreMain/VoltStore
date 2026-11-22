/* VoltGuide deterministic buyer/seller decision assistant. No AI claims, no network. */
(function (root) {
  'use strict';
  const MODES = Object.freeze({buy:'Покупаю', inspect:'Проверяю', sell:'Продаю'});
  const MAX_QUESTION = 450;
  function clean(value,max) {
    return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max||120);
  }
  function mode(value) { return Object.hasOwn(MODES,value) ? value : 'buy'; }
  function category(core,value) {
    return core && typeof core.resolveCategory==='function' ? core.resolveCategory(value) : 'smartphone';
  }
  function checksFor(core,cat) {
    return core && typeof core.getChecks==='function' ? core.getChecks(cat) : [];
  }
  function safeStatus(value) { return ['ok','issue','unknown'].includes(value) ? value : ''; }
  function findings(core,input) {
    const cat=category(core,input && input.category);
    const checks=checksFor(core,cat);
    const raw=input && input.inspection && typeof input.inspection==='object' ? input.inspection : {};
    const out=checks.map(c => ({
      id:c.id, title:c.title, tip:c.tip, critical:!!c.critical,
      status:safeStatus(raw[c.id] && raw[c.id].status)
    }));
    return {category:cat, checks:out,
      problems:out.filter(x=>x.status==='issue'),
      criticalProblems:out.filter(x=>x.status==='issue'&&x.critical),
      untested:out.filter(x=>!x.status||x.status==='unknown'),
      completed:out.filter(x=>!!x.status&&x.status!=='unknown')};
  }
  function advise(core,input) {
    input=input||{};
    const kind=mode(input.mode), result=findings(core,input);
    const cat=result.category, categoryLabel=core && core.getCategory ? core.getCategory(cat).label : 'товар';
    const price=Number(input.price);
    const shownPrice=Number.isFinite(price)&&price>0&&price<100000000?Math.round(price).toLocaleString('ru-RU')+' ₸':'не указана';
    const name=clean(input.model,90)||categoryLabel;
    const warnings=[], questions=[], steps=[];
    if(result.criticalProblems.length)
      warnings.push('Есть замечания по важным проверкам: '+result.criticalProblems.map(x=>x.title).join(', ')+'. Отложите оплату, пока не выясните причины.');
    if(result.problems.length && !result.criticalProblems.length)
      warnings.push('Есть отмеченные проблемы. Уточните стоимость устранения и принимайте решение только после проверки.');
    if(result.untested.length)
      warnings.push('Не проверено '+result.untested.length+' из '+result.checks.length+' пунктов. Отсутствие проверки не означает исправность.');
    if(!result.problems.length && !result.untested.length)
      warnings.push('Все пункты отмечены как исправные пользователем; это не профессиональная диагностика и не гарантия.');
    const prioritize=[...result.criticalProblems,...result.problems.filter(x=>!x.critical),
      ...result.untested.filter(x=>x.critical),
      ...result.untested.filter(x=>!x.critical)];
    const selected=prioritize.length?prioritize.slice(0,4):result.checks.filter(x=>x.critical).slice(0,4);
    for(const item of selected){
      if(kind==='sell')
        questions.push('Какие факты или фотографии подтверждают состояние: «'+item.title+'»?');
      else
        questions.push('Можете показать, как проверить: «'+item.title+'»?');
    }
    if(kind==='sell') {
      steps.push('Подготовьте точные фотографии и перечислите известные дефекты, не скрывая ремонт.');
      steps.push('Заполните VoltPassport. Отмечайте непроверенное как «Не знаю», а не «Исправно».');
      steps.push('До публикации проверьте актуальность цены самостоятельно: VoltGuide не знает рыночных цен.');
    } else {
      steps.push('Проверьте товар лично и сравните с описанием продавца.');
      steps.push('Откройте VoltCheck и пройдите важные пункты, сохраняя замечания.');
      steps.push('Не переводите предоплату незнакомому продавцу и не переходите по сомнительным ссылкам.');
    }
    const headline=result.criticalProblems.length?'Есть важные замечания':
      result.problems.length?'Нужна дополнительная проверка':
      result.untested.length?'Начните с ключевых проверок':'Проверка заполнена, но не заменяет экспертизу';
    return Object.freeze({
      category:cat, name, price:shownPrice, mode:kind, headline,
      summary:kind==='sell'?'Помогу честно подготовить объявление и паспорт товара.':
        'Помогу понять, что проверять и о чём спросить до передачи денег.',
      warnings,questions,steps,
      stats:{total:result.checks.length,issues:result.problems.length,critical:result.criticalProblems.length,untested:result.untested.length},
      disclaimer:'Советы основаны только на выбранной категории и ваших отметках. VoltStore не проверяет продавца, не определяет честную цену и не гарантирует сделку.'
    });
  }
  function maskSensitive(text) {
    return clean(text,MAX_QUESTION)
      .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g,'[электронный адрес скрыт]')
      .replace(/(?:\+?\d[\s()\-]*){9,}/g,'[номер скрыт]');
  }
  function aiPayload(core,input) {
    const result=advise(core,input);
    const question=maskSensitive(input&&input.question);
    if(!question) throw new Error('Введите вопрос перед запросом к модели.');
    return {category:result.category,mode:result.mode,question,
      model:clean(input&&input.model,80),price:result.price,
      flags:{hasCriticalIssues:result.stats.critical>0,issueCount:result.stats.issues,untestedCount:result.stats.untested}};
  }
  const exported=Object.freeze({MODES,clean,mode,category,findings,advise,maskSensitive,aiPayload});
  if(typeof module!=='undefined'&&module.exports) module.exports=exported;
  root.VoltGuideCore=exported;
})(typeof window!=='undefined'?window:globalThis);
