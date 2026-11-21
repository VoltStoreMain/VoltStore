/* VoltPhotos — private local draft photos.
   Compress to JPEG (EXIF removed), save Blobs in IndexedDB. NO upload/network.
   Never use this local store as evidence of a verified product. */
(function(root){
 'use strict';
 const DB='voltstore-local-photos-v1',TABLE='photos',LIMIT=4,MAX_SOURCE=12*1024*1024;
 const MAX_OUTPUT=950*1024,MAX_EDGE=1400;
 const TYPES=Object.freeze(['image/jpeg','image/png','image/webp','image/heic','image/heif']);
 function validateFile(file){
   if(!file||!TYPES.includes(file.type))throw new Error('Выбери JPG, PNG, WebP или фото HEIC с телефона.');
   if(!Number.isFinite(file.size)||file.size<=0||file.size>MAX_SOURCE)
     throw new Error('Одна фотография должна быть не больше 12 МБ.');
   return true;
 }
 function validId(id){return /^draft-[a-zA-Z0-9_-]{5,85}$/.test(String(id||''));}
 function requestDatabase(){
   if(!('indexedDB' in root))return Promise.reject(new Error('Этот браузер не поддерживает локальное хранение фотографий.'));
   return new Promise((resolve,reject)=>{
     const open=indexedDB.open(DB,1);
     open.onupgradeneeded=()=>{
       const db=open.result;if(!db.objectStoreNames.contains(TABLE)){
         const s=db.createObjectStore(TABLE,{keyPath:'key'});
         s.createIndex('listingId','listingId',{unique:false});
       }
     };
     open.onsuccess=()=>resolve(open.result);
     open.onerror=()=>reject(new Error('Не удалось открыть хранилище фотографий.'));
     open.onblocked=()=>reject(new Error('Хранилище фотографий занято другой вкладкой.'));
   });
 }
 async function store(txMode,fn){
   const db=await requestDatabase();
   try{return await new Promise((resolve,reject)=>{
     let tx;
     try{tx=db.transaction(TABLE,txMode);}catch(e){reject(e);return;}
     const object=tx.objectStore(TABLE),result=fn(object),out=[];
     for(const req of [].concat(result||[])){
       req.onsuccess=()=>out.push(req.result);
       req.onerror=()=>reject(new Error('Ошибка при работе с локальными фото.'));
     }
     tx.oncomplete=()=>resolve(out.length===1?out[0]:out);
     tx.onerror=()=>reject(new Error('Ошибка хранилища фотографий. Возможно, не хватает места.'));
     tx.onabort=()=>reject(new Error('Сохранение фотографии прервано.'));
   });}finally{db.close();}
 }
 async function imageFromFile(file){
   if('createImageBitmap' in root){
     try{
       const bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});
       return {width:bitmap.width,height:bitmap.height,
         draw:(ctx,w,h)=>{ctx.drawImage(bitmap,0,0,w,h);bitmap.close();}};
     }catch(_){}
   }
   const url=URL.createObjectURL(file);
   try{
     const img=new Image();
     img.src=url;
     if(typeof img.decode==='function')await img.decode();
     else await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;});
     return {width:img.naturalWidth,height:img.naturalHeight,
       draw:(ctx,w,h)=>{ctx.drawImage(img,0,0,w,h);URL.revokeObjectURL(url);}};
   }catch(err){URL.revokeObjectURL(url);throw err;}
 }
 function blobFromCanvas(canvas,q){
   return new Promise((resolve,reject)=>{
     canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Не удалось сжать фотографию.')),'image/jpeg',q);
   });
 }
 async function compress(file){
   validateFile(file);
   const image=await imageFromFile(file);
   if(image.width<120||image.height<120||image.width*image.height>60000000)
     throw new Error('Недопустимый размер изображения. Используй обычное фото товара.');
   const scale=Math.min(1,MAX_EDGE/Math.max(image.width,image.height));
   const canvas=document.createElement('canvas');
   canvas.width=Math.max(1,Math.round(image.width*scale));
   canvas.height=Math.max(1,Math.round(image.height*scale));
   const context=canvas.getContext('2d',{alpha:false});
   if(!context)throw new Error('Не удалось подготовить обработку фотографий.');
   context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height);
   image.draw(context,canvas.width,canvas.height);
   let blob=await blobFromCanvas(canvas,.78);
   if(blob.size>MAX_OUTPUT)blob=await blobFromCanvas(canvas,.57);
   if(blob.size>MAX_OUTPUT)throw new Error('Фото не удалось сжать до 950 КБ. Попробуй уменьшить его.');
   return blob;
 }
 async function save(id,files){
   if(!validId(id))throw new Error('Фотографии можно сохранять только для локального черновика.');
   const chosen=Array.from(files||[]);
   if(chosen.length>LIMIT)throw new Error('Можно выбрать не более четырёх фотографий.');
   if(!chosen.length)return [];
   chosen.forEach(validateFile);
   // Compress ALL images before the transaction, which stays short and atomic.
   const blobs=[];
   for(const file of chosen)blobs.push(await compress(file));
   await store('readwrite',s=>{
     const deletes=[];for(let i=0;i<LIMIT;i++)deletes.push(s.delete(id+':'+i));
     const writes=blobs.map((blob,i)=>s.put({key:id+':'+i,listingId:id,pos:i,
       blob,updated:Date.now()}));
     return deletes.concat(writes);
   });
   return blobs.map(b=>({bytes:b.size,type:b.type}));
 }
 async function list(id){
   if(!validId(id))return [];
   // Use exact keys, not arbitrary user-supplied key ranges.
   const out=await store('readonly',s=>Array.from({length:LIMIT},(_,i)=>s.get(id+':'+i)));
   return (Array.isArray(out)?out:[out]).filter(x=>x&&x.blob instanceof Blob)
     .sort((a,b)=>a.pos-b.pos).map(x=>x.blob);
 }
 async function first(id){
   if(!validId(id))return null;
   const row=await store('readonly',s=>s.get(id+':0'));
   return row&&row.blob instanceof Blob?row.blob:null;
 }
 async function remove(id){
   if(!validId(id))return;
   await store('readwrite',s=>Array.from({length:LIMIT},(_,i)=>s.delete(id+':'+i)));
 }
 const api=Object.freeze({LIMIT,MAX_SOURCE,MAX_OUTPUT,MAX_EDGE,TYPES,validateFile,validId,compress,save,list,first,remove});
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 root.VoltPhotos=api;
})(typeof window!=='undefined'?window:globalThis);
