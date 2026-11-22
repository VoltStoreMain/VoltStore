/* VoltStore shared mobile shell: thumb navigation, responsive filters, contextual primary action.
   No network requests, user data collection, fake status changes or payment operations. */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const page=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  const isMarket=page==='market.html',isDeal=page==='voltdeal.html';
  const media=matchMedia('(max-width:760px)');
  const nav=document.createElement('nav');
  nav.id='vmMobileNav';nav.setAttribute('aria-label','Мобильная навигация VoltStore');
  const menu=[
    {label:'Каталог',icon:'⌕',href:'market.html#discover',id:'catalog'},
    {label:'Продать',icon:'＋',href:'market.html#draft',id:'sell'},
    {label:'VoltGuide',icon:'✦',href:'voltguide.html',id:'guide'},
    {label:'Проверка',icon:'🛡',href:'voltcheck-all.html',id:'check'}
  ];
  nav.innerHTML=menu.map(item=>'<a href="'+item.href+'" data-tab="'+item.id+'"><span class="vm-icon" aria-hidden="true">'+item.icon+'</span><span>'+item.label+'</span></a>').join('');
  const selectedTab=page==='voltguide.html'?'guide':page.startsWith('voltcheck')||page==='voltpassport.html'?'check':isMarket?'catalog':'';
  nav.querySelectorAll('a[data-tab]').forEach(a=>{
    if(a.dataset.tab===selectedTab){a.classList.add('vm-selected');a.setAttribute('aria-current','page');}
  });
  document.body.appendChild(nav);
  const bar=document.createElement('div');bar.id='vmStickyAction';bar.hidden=true;
  bar.innerHTML='<button type="button" class="vm-secondary" id="vmSecondaryAction" hidden>🛡 Проверить</button><button type="button" class="vm-main" id="vmMainAction">Продолжить</button>';
  document.body.appendChild(bar);
  const main=$('vmMainAction'),secondary=$('vmSecondaryAction');
  let action=null,secondaryHref='';
  function sync(){
    action=null;secondaryHref='';secondary.hidden=true;
    if(media.matches&&isMarket){
      const detail=$('detailView');
      if(detail&&!detail.hidden){
        const anchor=detail.querySelector('a[href^="voltdeal.html?"]');
        const check=detail.querySelector('a[href^="voltcheck-all.html?"]');
        if(anchor){
          action={kind:'link',href:anchor.getAttribute('href')};
          main.textContent='🤝 Оформить · демо →';
          if(check){secondary.hidden=false;secondaryHref=check.getAttribute('href');}
        }
      }
    }else if(media.matches&&isDeal){
      const content=$('actionContent');
      if(content&&!($('dealContent')||{hidden:true}).hidden){
        const btn=content.querySelector('button.primary:not([disabled])');
        if(btn){
          action={kind:'button',element:btn};
          main.textContent=String(btn.textContent||'Продолжить').trim().replace(/\s*[→↗]\s*$/,'').slice(0,62)+' →';
        }
      }
    }
    bar.hidden=!action;
    document.body.classList.toggle('vm-has-sticky',!!action&&media.matches);
  }
  main.addEventListener('click',()=>{
    if(!action)return;
    if(action.kind==='link'){
      location.href=action.href;
    }else if(action.element&&document.contains(action.element)){
      action.element.click(); // Native HTML form validation and existing consent gates remain enforced.
    }
  });
  secondary.addEventListener('click',()=>{if(secondaryHref)location.href=secondaryHref;});
  if(isMarket){
    const discover=$('discover');
    // Notice is rendered in HTML before paint; never inject it after the page becomes visible.
    const filters=$('discover')?.querySelector('.filters');
    if(filters&&filters.children.length>=2&&!$('vmAdvancedFilters')){
      const advanced=document.createElement('details');
      advanced.id='vmAdvancedFilters';advanced.open=!media.matches;
      const summary=document.createElement('summary');
      summary.textContent='⚙ Фильтры по городу, состоянию и цене';
      const fields=document.createElement('div');fields.id='vmAdvancedFields';
      const others=Array.from(filters.children).slice(1);
      for(const node of others)fields.appendChild(node);
      advanced.append(summary,fields);
      filters.appendChild(advanced);
    }
    const detail=$('detailView'),content=$('detailContent');
    if(detail){
      const observer=new MutationObserver(sync);
      observer.observe(detail,{attributes:true,attributeFilter:['hidden']});
      if(content)observer.observe(content,{childList:true,subtree:false});
    }
  }
  if(isDeal){
    const content=$('actionContent'),wrapper=$('dealContent');
    const observer=new MutationObserver(sync);
    if(content)observer.observe(content,{childList:true,subtree:false});
    if(wrapper)observer.observe(wrapper,{attributes:true,attributeFilter:['hidden']});
    window.addEventListener('pageshow',sync);
  }
  const advanced=$('vmAdvancedFilters');
  const adapt=()=>{if(advanced)advanced.open=!media.matches;sync();};
  if(media.addEventListener)media.addEventListener('change',adapt);
  sync();
})();
