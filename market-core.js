/* VoltMarket domain model: category-aware discovery and LOCAL drafts only.
   No ads DB requests, payment operations, or claims of verification. */
(function(root){
  'use strict';
  const field=(id,label,type,options,min,max)=>Object.freeze({id,label,type,options:options||[],min,max});
  const categories=Object.freeze({
    smartphone:Object.freeze({id:'smartphone',name:'Смартфоны',icon:'📱',hint:'Аккаунт, батарея, связь и IMEI',fields:[
      field('brand','Бренд','select',['Apple','Samsung','Xiaomi','Google','Другой']),
      field('storage','Память','select',['64 ГБ','128 ГБ','256 ГБ','512 ГБ','1 ТБ']),
      field('battery','Состояние батареи, %','number',null,1,100)
    ]}),
    laptop:Object.freeze({id:'laptop',name:'Ноутбуки',icon:'💻',hint:'Память, охлаждение, блокировки и SSD',fields:[
      field('brand','Бренд','select',['Apple','Lenovo','ASUS','HP','Dell','Другой']),
      field('ram','Оперативная память','select',['8 ГБ','16 ГБ','32 ГБ','64 ГБ']),
      field('storage','Накопитель','select',['256 ГБ SSD','512 ГБ SSD','1 ТБ SSD','2 ТБ SSD'])
    ]}),
    furniture:Object.freeze({id:'furniture',name:'Мебель',icon:'🛋️',hint:'Каркас, обивка, габариты и состояние',fields:[
      field('kind','Тип','select',['Диван','Стол','Кресло','Шкаф','Кровать','Другое']),
      field('material','Материал','select',['Ткань','Кожа','Дерево','Металл','Комбинированный']),
      field('width','Ширина, см','number',null,1,1000)
    ]}),
    bicycle:Object.freeze({id:'bicycle',name:'Велосипеды',icon:'🚲',hint:'Рама, тормоза, трансмиссия и колёса',fields:[
      field('type','Тип','select',['Горный','Городской','Шоссейный','Гибрид','Детский']),
      field('frame','Рама','select',['XS','S','M','L','XL','Не знаю']),
      field('wheels','Колёса','select',['20″','24″','26″','27.5″','28″','29″'])
    ]})
  });
  const IDS=Object.freeze(Object.keys(categories));
  const CONDITIONS=Object.freeze(['Как новое','Отличное','Хорошее','Есть дефекты']);
  const CITY=['Алматы','Астана','Шымкент','Караганда'];
  const DEMO=Object.freeze([
    {id:'demo-phone-1',category:'smartphone',title:'iPhone 15 Pro, 256 ГБ',city:'Алматы',price:275000,condition:'Хорошее',attrs:{brand:'Apple',storage:'256 ГБ',battery:87},note:'Пример: следы использования на корпусе. Состояние по словам условного продавца; фактическая проверка не проводилась.',claims:{battery:'issue',screen:'unknown'}},
    {id:'demo-phone-2',category:'smartphone',title:'Samsung Galaxy S23, 128 ГБ',city:'Астана',price:185000,condition:'Отличное',attrs:{brand:'Samsung',storage:'128 ГБ',battery:92},note:'Демонстрационный товар. IMEI и работоспособность не подтверждены.',claims:{imei:'unknown',battery:'unknown'}},
    {id:'demo-laptop-1',category:'laptop',title:'Lenovo ThinkPad T14',city:'Алматы',price:235000,condition:'Хорошее',attrs:{brand:'Lenovo',ram:'16 ГБ',storage:'512 ГБ SSD'},note:'Пример: корпус имеет потёртости; состояние SSD не подтверждено.',claims:{body:'issue',storage:'unknown'}},
    {id:'demo-laptop-2',category:'laptop',title:'ASUS Zenbook 14',city:'Шымкент',price:320000,condition:'Как новое',attrs:{brand:'ASUS',ram:'16 ГБ',storage:'1 ТБ SSD'},note:'Демо: продавец не предоставил результаты проверки.',claims:{}},
    {id:'demo-furniture-1',category:'furniture',title:'Диван двухместный, ткань',city:'Алматы',price:80000,condition:'Есть дефекты',attrs:{kind:'Диван',material:'Ткань',width:185},note:'Пример: есть пятно на обивке. Проверьте каркас и запах при осмотре.',claims:{upholstery:'issue'}},
    {id:'demo-furniture-2',category:'furniture',title:'Обеденный стол, дуб',city:'Астана',price:68000,condition:'Хорошее',attrs:{kind:'Стол',material:'Дерево',width:160},note:'Демо: следует проверить устойчивость, размеры и крепления.',claims:{}},
    {id:'demo-bicycle-1',category:'bicycle',title:'Горный велосипед 29″',city:'Караганда',price:115000,condition:'Хорошее',attrs:{type:'Горный',frame:'M',wheels:'29″'},note:'Пример: тормоза необходимо проверять на месте.',claims:{brakes:'unknown'}},
    {id:'demo-bicycle-2',category:'bicycle',title:'Городской велосипед, рама S',city:'Алматы',price:65000,condition:'Отличное',attrs:{type:'Городской',frame:'S',wheels:'28″'},note:'Демо: описание не является подтверждением исправности.',claims:{}}
  ].map(v=>Object.freeze({...v,kind:'demo'})));
  function clean(value,max=160){return String(value==null?'':value).replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);}
  function category(id){return Object.prototype.hasOwnProperty.call(categories,id)?categories[id]:categories.smartphone;}
  function number(value,min,max){if(value===''||value==null)return null;const n=Number(value);return Number.isFinite(n)&&n>=min&&n<=max?Math.round(n):null;}
  function attributes(cat,raw){
    const o=Object.create(null),data=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
    for(const f of category(cat).fields){
      const v=Object.prototype.hasOwnProperty.call(data,f.id)?data[f.id]:undefined;
      if(f.type==='select'){const t=clean(v,60);if(f.options.includes(t))o[f.id]=t;}
      else {const n=number(v,f.min,f.max);if(n!==null)o[f.id]=n;}
    }
    return o;
  }
  function normalize(raw){
    if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
    const cat=raw.category;
    if(!IDS.includes(cat))return null;
    const title=clean(raw.title,90),city=clean(raw.city,40),note=clean(raw.note,500);
    const price=number(raw.price,1000,30000000);
    if(title.length<4||city.length<2||price===null||!CONDITIONS.includes(raw.condition))return null;
    const kind=raw.kind==='draft'?'draft':'demo';
    const id=clean(raw.id,90);
    if(!/^(?:draft|demo)-[a-zA-Z0-9_-]{5,85}$/.test(id))return null;
    const claims=Object.create(null),incoming=raw.claims&&typeof raw.claims==='object'&&!Array.isArray(raw.claims)?raw.claims:{};
    for(const key of Object.keys(incoming)){
      if(/^[a-z][a-z0-9_-]{0,40}$/.test(key)&&['ok','issue','unknown'].includes(incoming[key]))claims[key]=incoming[key];
    }
    return {id,category:cat,title,city,price,condition:raw.condition,note,
      attrs:attributes(cat,raw.attrs),claims,kind,created:number(raw.created,1,32503680000000)||0};
  }
  function samples(){return DEMO.map(x=>normalize(x));}
  function matches(item,f){
    if(!item)return false;
    const q=clean(f.q,100).toLocaleLowerCase('ru-RU');
    if(f.category&&f.category!=='all'&&item.category!==f.category)return false;
    if(f.city&&item.city!==f.city)return false;
    if(f.condition&&item.condition!==f.condition)return false;
    if(q&&!(item.title+' '+item.city+' '+Object.values(item.attrs).join(' ')).toLocaleLowerCase('ru-RU').includes(q))return false;
    const mx=number(f.maxPrice,1,30000000);
    if(mx!==null&&item.price>mx)return false;
    if(f.attribute&&f.attributeValue&&String(item.attrs[f.attribute]||'')!==String(f.attributeValue))return false;
    return true;
  }
  function filter(items,f){
    const criteria=f||{};
    const result=items.filter(x=>matches(x,criteria));
    const sort=criteria.sort;
    if(sort==='priceAsc')result.sort((a,b)=>a.price-b.price);
    else if(sort==='priceDesc')result.sort((a,b)=>b.price-a.price);
    else result.sort((a,b)=>(b.created||0)-(a.created||0)||a.title.localeCompare(b.title,'ru'));
    return result;
  }
  function link(item,target){
    const params=new URLSearchParams({category:item.category,model:item.title,price:String(item.price)});
    if(item.id)params.set('ad',item.id);
    if(target==='guide')return 'voltguide.html?'+params;
    if(target==='check')return 'voltcheck-all.html?'+params;
    if(target==='passport'){params.set('demo','1');return 'voltpassport.html?'+params;}
    return 'market.html#item/'+encodeURIComponent(item.id);
  }
  const exported=Object.freeze({CATEGORIES:categories,CATEGORY_IDS:IDS,CONDITIONS,DEMO,clean,category,attributes,normalize,samples,matches,filter,link});
  if(typeof module!=='undefined'&&module.exports)module.exports=exported;
  root.VoltMarketCore=exported;
})(typeof window!=='undefined'?window:globalThis);
