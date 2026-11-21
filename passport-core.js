/* VoltPassport v1 | shared, framework-free domain logic. */
(function (root) {
  'use strict';
  const CHECKS = Object.freeze([
    { id:'activation', title:'Блокировки аккаунта', critical:true, tip:'Покажите, что устройство не привязано к чужому Apple/Google-аккаунту.' },
    { id:'imei', title:'IMEI и регистрация', critical:true, tip:'Сверьте IMEI на устройстве и проверяйте статус на официальном портале. Не публикуйте полный IMEI.' },
    { id:'screen', title:'Экран и сенсор', critical:true, tip:'Проверьте пятна, полосы, битые пиксели, касания и состояние стекла.' },
    { id:'network', title:'Связь, SIM и интернет', critical:true, tip:'Проверьте SIM, звонки, мобильную передачу данных, сеть.' },
    { id:'charge', title:'Зарядка и разъём', critical:true, tip:'Проверьте зарядку, кабель, контакты и отсутствие перебоев.' },
    { id:'battery', title:'Аккумулятор', critical:false, tip:'Уточните остаточную ёмкость, замены и возможные отключения.' },
    { id:'camera', title:'Камеры и вспышка', critical:false, tip:'Проверьте фото и видео на всех модулях, автофокус и вспышку.' },
    { id:'audio', title:'Микрофоны и динамики', critical:false, tip:'Запишите и воспроизведите голос, проверьте разговорный динамик.' },
    { id:'biometrics', title:'Биометрия и кнопки', critical:false, tip:'Проверьте Face ID/Touch ID, механические кнопки и вибрацию.' },
    { id:'wireless', title:'Wi-Fi и Bluetooth', critical:false, tip:'Подключитесь к Wi-Fi и Bluetooth, проверьте стабильность.' },
    { id:'history', title:'Ремонт, вода и комплект', critical:false, tip:'Уточните замены деталей, попадание воды, документы и комплект.' }
  ]);
  const STATUS = Object.freeze({ ok:'Работает / замечаний нет', issue:'Есть дефект / замечание', unknown:'Не проверено' });
  function clean(value, max=180) { return String(value==null?'':value).replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max); }
  function normalize(raw) {
    const result=Object.create(null);
    CHECKS.forEach(c => {
      const o=raw && typeof raw==='object' && !Array.isArray(raw) && raw[c.id] && typeof raw[c.id]==='object' ? raw[c.id] : {};
      result[c.id]={ status:Object.prototype.hasOwnProperty.call(STATUS,o.status)?o.status:'unknown', note:clean(o.note,180) };
    });
    return result;
  }
  function summarize(raw) {
    const state=normalize(raw), summary={total:CHECKS.length,filled:0,ok:0,issue:0,unknown:0,criticalIssues:[]};
    CHECKS.forEach(c=>{const v=state[c.id].status;summary[v]++;if(v!=='unknown')summary.filled++;if(v==='issue'&&c.critical)summary.criticalIssues.push(c.id);});
    return summary;
  }
  function compare(sellerInput,buyerInput) {
    const seller=normalize(sellerInput), buyer=normalize(buyerInput);
    const result={checked:0,matches:0,mismatches:[],unconfirmed:[],criticalMismatches:[]};
    CHECKS.forEach(c=>{
      const a=seller[c.id].status, b=buyer[c.id].status;
      if(b==='unknown')return;
      result.checked++;
      if(a==='unknown'){result.unconfirmed.push(c.id);return;}
      if(a!==b){result.mismatches.push(c.id);if(c.critical)result.criticalMismatches.push(c.id);}
      else result.matches++;
    });
    return result;
  }
  function normalizeVoltCheck(raw) {
    const source=raw && typeof raw==='object' && raw.state ? raw.state : raw;
    return normalize(source);
  }
  root.VoltPassportCore=Object.freeze({CHECKS,STATUS,clean,normalize,summarize,compare,normalizeVoltCheck});
})(typeof window!=='undefined'?window:globalThis);
