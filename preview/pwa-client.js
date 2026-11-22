/* VoltStore PWA installer: opt-in, no auto-prompts, no app data collection.
   Works only on HTTPS/localhost. Static service worker never caches API/auth. */
(function(){
 'use strict';
 const secure=location.protocol==='https:'||['localhost','127.0.0.1'].includes(location.hostname);
 const inStandalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
 const $=id=>document.getElementById(id);
 let deferred=null,registration=null,reloading=false,applyingUpdate=false;
 const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||
   (navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 const banner=$('pwaInstall'),message=$('pwaMessage'),installButton=$('pwaInstallButton'),dismiss=$('pwaDismiss');
 function dismissed(){
   try{return sessionStorage.getItem('voltstore-pwa-dismiss')==='1';}catch(_){return false;}
 }
 function showBanner(mode){
   if(!banner||inStandalone||dismissed())return;
   banner.hidden=false;
   if(mode==='prompt'){
     if(message)message.textContent='Установи VoltStore на главный экран — каталог и сохранённые проверки будут под рукой.';
     if(installButton){installButton.hidden=false;installButton.textContent='Установить';}
   }else if(mode==='ios'){
     if(message)message.textContent='На iPhone: нажми «Поделиться» и выбери «На экран Домой».';
     if(installButton)installButton.hidden=true;
   }
 }
 window.addEventListener('beforeinstallprompt',event=>{
   event.preventDefault();deferred=event;showBanner('prompt');
 });
 window.addEventListener('appinstalled',()=>{deferred=null;if(banner)banner.hidden=true;});
 if(isIOS&&secure&&!inStandalone)showBanner('ios');
 if(installButton)installButton.addEventListener('click',async()=>{
   if(!deferred)return;
   const prompt=deferred;deferred=null;banner.hidden=true;
   try{await prompt.prompt();await prompt.userChoice;}catch(_){}
 });
 if(dismiss)dismiss.addEventListener('click',()=>{
   banner.hidden=true;try{sessionStorage.setItem('voltstore-pwa-dismiss','1');}catch(_){}
 });
 function updateNotice(){
   if(!registration||!registration.waiting||!navigator.serviceWorker.controller)return;
   const root=$('pwaUpdate');if(!root)return;
   root.hidden=false;
   const btn=root.querySelector('button');
   if(btn)btn.addEventListener('click',()=>{
     if(registration.waiting){applyingUpdate=true;registration.waiting.postMessage({type:'SKIP_WAITING'});}
   },{once:true});
 }
 if(!secure||!('serviceWorker' in navigator))return;
 window.addEventListener('load',async()=>{
   try{
     registration=await navigator.serviceWorker.register('./sw.js',{scope:'./'});
     if(registration.waiting)updateNotice();
     registration.addEventListener('updatefound',()=>{
       const worker=registration.installing;
       if(!worker)return;
       worker.addEventListener('statechange',()=>{
         if(worker.state==='installed'&&navigator.serviceWorker.controller)updateNotice();
       });
     });
     navigator.serviceWorker.addEventListener('controllerchange',()=>{
       // First installation claims the tab without reloading: never discard unsaved seller forms.
       if(!applyingUpdate||reloading)return;
       reloading=true;location.reload();
     });
   }catch(err){ // Installing should never stop using the marketplace.
     if(location.hostname==='localhost')console.warn('VoltStore PWA worker:',err);
   }
 },{once:true});
})();