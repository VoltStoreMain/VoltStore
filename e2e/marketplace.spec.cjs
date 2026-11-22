const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const samplePng=fs.readFileSync(path.join(__dirname,'..','icons','voltstore-192.png'));

test('каталог: категории, поиск, фильтры и экран без горизонтального переполнения',async({page},testInfo)=>{
  const jsErrors=[];
  page.on('pageerror',error=>jsErrors.push(error.message));
  await page.goto('/market.html');
  await expect(page.locator('#listingGrid .listing')).toHaveCount(8);
  await expect(page.locator('#categoryTabs [data-category="laptop"]')).toBeVisible();
  await page.locator('#categoryTabs [data-category="laptop"]').click();
  await expect(page.locator('#listingGrid .listing')).toHaveCount(2);
  await page.locator('#search').fill('ThinkPad');
  await expect(page.locator('#listingGrid .listing')).toHaveCount(1);
  await expect(page.locator('#listingGrid')).toContainText('ThinkPad');
  await page.locator('#resetFilters').click();
  await expect(page.locator('#listingGrid .listing')).toHaveCount(8);
  const dimensions=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
  expect(dimensions.scroll,JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.width+2);
  await page.screenshot({path:testInfo.outputPath('catalog.png'),fullPage:true});
  expect(jsErrors).toEqual([]);
});

test('карточка открывает VoltDeal с тем же товаром, а не отдельный чужой пример',async({page})=>{
  await page.goto('/market.html');
  await page.locator('#listingGrid [data-open="demo-phone-1"]').click();
  await expect(page.locator('#detailView')).toBeVisible();
  await expect(page.locator('#detailTitle')).toContainText('iPhone');
  const href=await page.locator('#detailView .deal-entry a[href^="voltdeal.html"]').getAttribute('href');
  expect(href).toContain('ad=demo-phone-1');
  // On phones the primary action stays fixed; on desktop the contextual button remains in the card.
  if(await page.locator('#vmStickyAction').isVisible()){
    await page.locator('#vmMainAction').click();
  }else{
    await page.locator('#detailView .deal-entry a[href^="voltdeal.html"]').click();
  }
  await expect(page).toHaveURL(/voltdeal\.html\?ad=demo-phone-1/);
  await expect(page.locator('#itemSummary')).toContainText('iPhone 15 Pro');
  await expect(page.locator('#statusBox')).toContainText('Заявка ещё не создана');
});

test('VoltDeal: обе роли, обязательные согласия, осмотр и завершение без фиктивного платежа',async({page},testInfo)=>{
  const jsErrors=[];
  page.on('pageerror',error=>jsErrors.push(error.message));
  await page.goto('/voltdeal.html?ad=demo-phone-1');
  await expect(page.locator('#requestForm')).toBeVisible();
  await page.locator('#requestForm button[type="submit"]').click();
  await expect(page.locator('#statusBox')).toContainText('Заявка ещё не создана');
  await page.locator('#requestForm input[name="understood"]').check();
  await page.locator('#requestForm button[type="submit"]').click();
  await expect(page.locator('#statusBox')).toContainText('Заявка отправлена');
  await page.locator('#roles [data-role="seller"]').click();
  await page.locator('[data-event="seller_accept"]').click();
  await expect(page.locator('#statusBox')).toContainText('Условия подтверждены');
  await page.locator('#roles [data-role="buyer"]').click();
  await expect(page.locator('#inspectionForm')).toBeVisible();
  await page.locator('#inspectionForm select[name="result"]').selectOption('ok');
  await page.locator('#inspectionForm input[name="checked"]').check();
  await page.locator('#inspectionForm button[type="submit"]').click();
  await expect(page.locator('#statusBox')).toContainText('Осмотр отмечен');
  await page.locator('#buyerFinishForm input[name="handover"]').check();
  await page.locator('#buyerFinishForm button[type="submit"]').click();
  await expect(page.locator('#statusBox')).toContainText('Покупатель подтвердил');
  await page.locator('#roles [data-role="seller"]').click();
  await page.locator('#sellerFinishForm input[name="handover"]').check();
  await page.locator('#sellerFinishForm button[type="submit"]').click();
  await expect(page.locator('#statusBox')).toContainText('Обе стороны отметили передачу');
  await expect(page.locator('#history .history-item')).toHaveCount(5);
  await expect(page.locator('#dealContent')).toContainText('Это не подтверждение оплаты');
  await page.screenshot({path:testInfo.outputPath('completed-deal.png'),fullPage:true});
  expect(jsErrors).toEqual([]);
});

test('черновик продавца: фото, галерея, локальное сохранение и удаление',async({page},testInfo)=>{
  const jsErrors=[];page.on('pageerror',error=>jsErrors.push(error.message));
  await page.goto('/market.html#draft');
  await expect(page.locator('#draftView')).toBeVisible();
  await page.locator('#formCategory').selectOption('laptop');
  await page.locator('#formTitle').fill('Ноутбук для теста VoltStore');
  await page.locator('#formPrice').fill('123000');
  await page.locator('#formCity').fill('Алматы');
  await page.locator('#formCondition').selectOption('Хорошее');
  await page.locator('#formNote').fill('Демонстрационный черновик без реальной публикации.');
  await page.locator('#formPhotos').setInputFiles({name:'qa-fixture.png',mimeType:'image/png',buffer:samplePng});
  await expect(page.locator('#photoPreview img')).toHaveCount(1);
  await page.locator('#draftForm button[type="submit"]').click();
  await expect(page.locator('#detailView')).toBeVisible();
  await expect(page.locator('#detailTitle')).toContainText('Ноутбук для теста');
  await expect(page.locator('#detailGallery .gallery-main')).toBeVisible({timeout:15000});
  await expect(page.locator('#galleryThumbs .gallery-thumb')).toHaveCount(1);
  await page.screenshot({path:testInfo.outputPath('draft-with-photo.png'),fullPage:true});
  const id=await page.evaluate(()=>decodeURIComponent(location.hash.split('/').pop()));
  expect(id).toMatch(/^draft-/);
  await page.reload();
  await expect(page.locator('#detailGallery .gallery-main')).toBeVisible({timeout:15000});
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#deleteDraft').click();
  await expect(page.locator('#detailView')).toBeHidden();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('voltmarket-local-drafts-v1')||'[]'));
  expect(saved.some(x=>x.id===id)).toBe(false);
  expect(jsErrors).toEqual([]);
});

test('бесплатный VoltGuide показывает советы без вызова внешнего AI',async({page})=>{
  const apiCalls=[];
  page.on('request',request=>{if(request.url().includes('api.openai.com')||request.url().includes('/.netlify/functions/'))apiCalls.push(request.url());});
  await page.goto('/voltguide.html?category=laptop&model=ThinkPad&price=200000');
  await expect(page.locator('#category')).toHaveValue('laptop');
  await expect(page.locator('#questions li').first()).toBeVisible();
  await expect(page.locator('#steps li').first()).toBeVisible();
  await expect(page.locator('#aiResult')).toBeHidden();
  expect(apiCalls).toEqual([]);
});

test('PWA: офлайн-каталог и кэш без параметров товара/авторизации',async({page,context,browserName})=>{
  test.skip(browserName!=='chromium','Проверка SW выполняется в Chromium, поддержка WebKit проверяется отдельно на устройстве');
  await page.goto('/market.html');
  await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker?.controller),{timeout:25000}).toBe(true);
  const cache=await page.evaluate(async()=>{
    const keys=await caches.keys(),entries=[];
    for(const key of keys){
      const c=await caches.open(key);
      entries.push(...(await c.keys()).map(req=>req.url));
    }
    return {keys,entries};
  });
  expect(cache.keys.some(k=>k.startsWith('voltstore-static-'))).toBe(true);
  for(const url of cache.entries){
    const u=new URL(url);
    expect(u.search).toBe('');
    expect(u.pathname).not.toMatch(/\/\.netlify\/|\/auth\/|\/api\/|\/config\.js$|\/live\.js$/);
  }
  await context.setOffline(true);
  try{
    await page.goto('/market.html',{waitUntil:'domcontentloaded'});
    await expect(page.locator('#listingGrid .listing').first()).toBeVisible({timeout:12000});
  }finally{await context.setOffline(false);}
});
