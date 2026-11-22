/* VoltCheck Universal: independent buyer inspection, no accounts and no server writes. */
(function () {
  'use strict';
  const core=window.VoltPassportCore;if(!core)return;
  const $=id=>document.getElementById(id);
  const query=new URLSearchParams(location.search);
  let category=core.resolveCategory(query.get('category'));
  let adId=core.clean(query.get('ad'),80);
  let state=core.normalize(null,category);
  let noticeTimer;
  let initialModel=core.clean(query.get('model'),100),initialPrice=Number(query.get('price'));
  const inputModel=$('model'),inputPrice=$('price');
  function key(){return 'voltcheck-universal-v1:'+category+':'+(adId||'manual');}
  function localRead(){try{return JSON.parse(sessionStorage.getItem(key())||'null');}catch(_){return null;}}
  function persist(){try{sessionStorage.setItem(key(),JSON.stringify({state,model:inputModel.value.slice(0,100),price:inputPrice.value}));}catch(_){/* inspection still works */}}
  function message(text){const el=$('toast');clearTimeout(noticeTimer);el.textContent=text;el.classList.add('visible');noticeTimer=setTimeout(()=>el.classList.remove('visible'),3000);}
  function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;}
  function render(){
    const checks=core.getChecks(category),parent=$('checksList');parent.replaceChildren();
    checks.forEach((check,index)=>{
      const root=el('section','check card'),top=el('div','check-top');
      top.appendChild(el('span','number',String(index+1).padStart(2,'0')));
      const description=el('div','check-copy');const title=el('h3','',check.title);
      if(check.critical)title.appendChild(el('span','critical','ВАЖНО'));
      description.append(title,el('p','tip',check.tip));top.appendChild(description);root.appendChild(top);
      const grid=el('div','check-grid'),box=el('div','check-col'),choices=el('div','choices');
      box.appendChild(el('div','col-label','МОЯ ПРОВЕРКА · РЕЗУЛЬТАТ НЕ ПУБЛИКУЕТСЯ'));
      [['ok','✓ Работает'],['issue','! Проблема'],['unknown','? Не проверил']].forEach(([code,label])=>{
        const b=el('button','choice'+(state[check.id].status===code?' active':''),label);
        b.type='button';b.dataset.check=check.id;b.dataset.status=code;b.setAttribute('aria-pressed',String(state[check.id].status===code));choices.appendChild(b);
      });
      box.appendChild(choices);const note=el('textarea','note-input');note.dataset.note=check.id;note.rows=2;note.maxLength=180;note.placeholder='Что заметили? Не добавляйте контакты или документы.';note.value=state[check.id].note;
      box.appendChild(note);grid.appendChild(box);root.appendChild(grid);parent.appendChild(root);
    });
    const c=core.getCategory(category);$('categoryTitle').textContent=c.icon+' '+c.label;
    $('categorySubtitle').textContent=c.subtitle;
    $('openPassport').href='voltpassport.html?'+new URLSearchParams({demo:'1',category}).toString();
    const guideParams=new URLSearchParams({category});if(adId)guideParams.set('ad',adId);
    if(inputModel.value.trim())guideParams.set('model',inputModel.value.trim().slice(0,90));
    if(inputPrice.value)guideParams.set('price',inputPrice.value);
    $('openGuide').href='voltguide.html?'+guideParams.toString();
    summarize();
  }
  function summarize(){
    const r=core.summarize(state,category),checks=core.getChecks(category);$('statChecked').textContent=r.filled+'/'+r.total;$('statIssues').textContent=r.issue;$('statImportant').textContent=r.criticalIssues.length;
    $('progressFill').style.width=(r.filled/r.total*100)+'%';
    const title=$('resultTitle'),text=$('resultText'),notes=$('resultNotes');notes.replaceChildren();
    if(r.criticalIssues.length){title.textContent='Есть серьёзные замечания';text.textContent='Не используйте товар без выяснения причин и консультации со специалистом там, где это необходимо.';}
    else if(r.issue){title.textContent='Вы отметили дефекты';text.textContent='Уточните стоимость исправления и согласуйте условия покупки. Не считайте остальные пункты проверенными автоматически.';}
    else if(r.criticalUnknown.length){title.textContent='Важные проверки не завершены';text.textContent='Неизвестное состояние критических узлов — повод продолжить осмотр до оплаты.';}
    else if(r.unknown){title.textContent='Осмотр ещё не завершён';text.textContent='Продолжайте проверку. Отметки «Не проверил» — не подтверждение исправности.';}
    else{title.textContent='Вами не отмечено замечаний';text.textContent='Это только результат вашей самостоятельной проверки, а не сертификат или гарантия исправности.';}
    r.criticalIssues.forEach(id=>notes.appendChild(el('span','note-pill critical-warn','Критически важно: '+checks.find(x=>x.id===id).title)));
    r.criticalUnknown.forEach(id=>notes.appendChild(el('span','note-pill','Не проверено: '+checks.find(x=>x.id===id).title)));
  }
  function load(){
    const cached=localRead();state=core.normalize(cached?.state,category);
    inputModel.value=cached?.model||initialModel||'';
    inputModel.placeholder=core.getCategory(category).example;
    inputPrice.value=cached?.price||((Number.isFinite(initialPrice)&&initialPrice>0&&initialPrice<=1e8)?initialPrice:'');
    render();
  }
  function exportReport(){
    const r=core.summarize(state,category);const lines=[
      'VOLTSTORE / VOLTCHECK UNIVERSAL',
      'Личный чек-лист покупателя. НЕ независимая экспертиза.',
      'Категория: '+core.getCategory(category).label,
      'Товар: '+(core.clean(inputModel.value,100)||'Не указан'),
      'Дата: '+new Date().toLocaleString('ru-RU'),
      `Проверено: ${r.filled}/${r.total}; замечаний: ${r.issue}; неизвестно: ${r.unknown}.`,''
    ];
    core.getChecks(category).forEach(check=>{
      const item=state[check.id];lines.push(`${check.critical?'[ВАЖНО] ':''}${check.title}: ${core.STATUS[item.status]}`);
      if(item.note)lines.push('  Комментарий: '+core.clean(item.note,180));
    });
    lines.push('', 'Этот отчёт содержит только отметки покупателя. VoltStore не проверял состояние товара и не гарантирует сделку.');
    const blob=new Blob([lines.join('\n')],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download='VoltCheck-'+category+'-'+Date.now()+'.txt';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  core.CATEGORY_IDS.forEach(id=>{const c=core.getCategory(id);const option=el('option','',c.icon+' '+c.label);option.value=id;$('category').append(option);});
  $('category').value=category;
  $('category').addEventListener('change',e=>{
    persist();category=core.resolveCategory(e.target.value);adId='';
    const url=new URL(location.href);url.searchParams.set('category',category);url.searchParams.delete('ad');url.searchParams.delete('model');url.searchParams.delete('price');history.replaceState(null,'',url);
    initialModel='';initialPrice=0;inputModel.value='';inputPrice.value='';load();message('Набор проверок изменён');
  });
  $('checksList').addEventListener('click',e=>{
    const b=e.target.closest('button[data-check][data-status]');if(!b)return;
    const id=b.dataset.check,status=b.dataset.status;if(!core.getChecks(category).some(x=>x.id===id)||!Object.hasOwn(core.STATUS,status))return;
    state[id].status=status;persist();render();
  });
  $('checksList').addEventListener('input',e=>{
    const ta=e.target;if(!ta.matches('textarea[data-note]'))return;
    const id=ta.dataset.note;if(!core.getChecks(category).some(x=>x.id===id))return;
    state[id].note=core.clean(ta.value,180);persist();
  });
  inputModel.addEventListener('input',()=>{persist();render();});inputPrice.addEventListener('input',()=>{persist();render();});
  $('download').addEventListener('click',exportReport);
  $('print').addEventListener('click',()=>window.print());
  $('reset').addEventListener('click',()=>{
    if(!confirm('Удалить все ваши отметки для этой категории?'))return;
    state=core.normalize(null,category);persist();render();message('Отметки очищены');
  });
  load();
})();
