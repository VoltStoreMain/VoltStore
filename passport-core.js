/* VoltStore universal inspection domain core v2. Vanilla JS / browser + Node. */
(function (root) {
  'use strict';
  const def = (id, title, tip, critical = false) => Object.freeze({ id, title, tip, critical });
  const categories = Object.freeze({
    smartphone: Object.freeze({
      id: 'smartphone', label: 'Смартфон', icon: '📱', example: 'iPhone 15 Pro 256 ГБ',
      subtitle: 'Аккаунты, IMEI, экран, связь и компоненты',
      checks: Object.freeze([
        def('activation', 'Блокировки аккаунта', 'Покажите, что устройство не привязано к чужому Apple/Google-аккаунту.', true),
        def('imei', 'IMEI и регистрация', 'Сверьте IMEI на устройстве и проверьте статус на официальном портале. Не публикуйте полный IMEI.', true),
        def('screen', 'Экран и сенсор', 'Проверьте пятна, полосы, битые пиксели, касания и состояние стекла.', true),
        def('network', 'Связь, SIM и интернет', 'Проверьте SIM, звонки, мобильную передачу данных, сеть.', true),
        def('charge', 'Зарядка и разъём', 'Проверьте зарядку, кабель, контакты и отсутствие перебоев.', true),
        def('battery', 'Аккумулятор', 'Уточните остаточную ёмкость, замены и возможные отключения.'),
        def('camera', 'Камеры и вспышка', 'Проверьте фото и видео на всех модулях, автофокус и вспышку.'),
        def('audio', 'Микрофоны и динамики', 'Запишите и воспроизведите голос, проверьте разговорный динамик.'),
        def('biometrics', 'Биометрия и кнопки', 'Проверьте Face ID/Touch ID, механические кнопки и вибрацию.'),
        def('wireless', 'Wi-Fi и Bluetooth', 'Подключитесь к Wi-Fi и Bluetooth, проверьте стабильность.'),
        def('history', 'Ремонт, вода и комплект', 'Уточните замены деталей, попадание воды, документы и комплект.')
      ])
    }),
    laptop: Object.freeze({
      id: 'laptop', label: 'Ноутбук', icon: '💻', example: 'Lenovo ThinkPad T14',
      subtitle: 'Экран, батарея, накопитель, порты и блокировки',
      checks: Object.freeze([
        def('account', 'BIOS, MDM и учётные записи', 'Проверьте отсутствие неизвестных паролей BIOS и управления организацией (MDM).', true),
        def('display', 'Экран и подсветка', 'Проверьте пятна, пиксели, мерцание, шарнир и изменение яркости.', true),
        def('power', 'Включение и питание', 'Несколько раз включите устройство и проверьте безопасное подключение зарядки.', true),
        def('storage', 'SSD и данные', 'Проверьте обнаружение накопителя и его состояние доступными системными инструментами.', true),
        def('keyboard', 'Клавиатура и тачпад', 'Проверьте все клавиши, жесты, подсветку и состояние тачпада.'),
        def('battery', 'Автономность и аккумулятор', 'Уточните циклы, износ, внезапные выключения и зарядку от сети.'),
        def('ports', 'USB, видео и аудиоразъёмы', 'Протестируйте используемые USB, HDMI, USB-C и аудиоразъёмы.'),
        def('network', 'Wi-Fi, Bluetooth, камера', 'Проверьте подключение к сети, веб-камеру, микрофон и динамики.'),
        def('performance', 'Нагрузка и охлаждение', 'Оцените перегрев, шум вентиляторов и зависания при обычной нагрузке.'),
        def('body', 'Корпус и крепления', 'Осмотрите петли, винты, крышку, трещины и следы попадания жидкости.'),
        def('history', 'Ремонт и комплектация', 'Уточните замены деталей, гарантию, наличие оригинального зарядного устройства.')
      ])
    }),
    furniture: Object.freeze({
      id: 'furniture', label: 'Мебель', icon: '🛋️', example: 'Диван трёхместный',
      subtitle: 'Каркас, крепления, обивка, запах и логистика',
      checks: Object.freeze([
        def('frame', 'Каркас и устойчивость', 'Сядьте/слегка нагрузите в обычном режиме, проверьте шатание, трещины и опоры.', true),
        def('pests', 'Следы насекомых', 'Осмотрите швы и скрытые места на признаки вредителей; подозрения требуют специалиста.', true),
        def('mold', 'Сырость и плесень', 'Осмотрите нижнюю часть, заднюю стенку, швы, видимые пятна и запах сырости.', true),
        def('mechanism', 'Раскладные и подвижные части', 'Проверьте раскладывание, фиксацию, ящики и петли без усилия.', true),
        def('surface', 'Поверхности и царапины', 'Осмотрите сколы, вмятины, трещины, следы реставрации.'),
        def('upholstery', 'Обивка и швы', 'Осмотрите порезы, затяжки, состояние ткани/кожи и швы.'),
        def('odor', 'Посторонние запахи', 'Проверьте запах дыма, животных, химии или хранения во влажном помещении.'),
        def('dimensions', 'Точные габариты', 'Измерьте длину, ширину, высоту и проверьте, проходит ли через двери/лифт.'),
        def('hardware', 'Фурнитура и крепёж', 'Проверьте ручки, ролики, ножки, крепления и наличие деталей.'),
        def('comfort', 'Удобство и проседание', 'Проверьте подушки, наполнитель и проседание при обычном использовании.'),
        def('transport', 'Разборка и транспортировка', 'Уточните разборность, упаковку, подъём, возможность безопасно перевезти.')
      ])
    }),
    bicycle: Object.freeze({
      id: 'bicycle', label: 'Велосипед', icon: '🚲', example: 'Горный велосипед Trek Marlin',
      subtitle: 'Рама, тормоза, колёса, трансмиссия и размер',
      checks: Object.freeze([
        def('frame', 'Рама и трещины', 'Осмотрите сварные швы, вилку и стыки. Трещины требуют отказа от езды до оценки специалиста.', true),
        def('brakes', 'Тормоза', 'Проверьте передний/задний тормоз, колодки, утечки и работу ручек в безопасном месте.', true),
        def('wheels', 'Колёса и покрышки', 'Проверьте восьмёрки, спицы, покрышки, обода, крепление осей.', true),
        def('fork', 'Вилка и амортизаторы', 'Оцените люфт, трещины, потёки масла и работу подвески.', true),
        def('chain', 'Цепь и звёзды', 'Проверьте ржавчину, растяжение цепи и износ зубьев.'),
        def('gears', 'Переключение передач', 'По возможности проверьте все передачи и отсутствие срывов.'),
        def('bearings', 'Каретка и подшипники', 'Проверьте люфт, стук, равномерность вращения и посторонний шум.'),
        def('fit', 'Размер рамы', 'Уточните рост, вынос, высоту седла и удобство посадки.'),
        def('controls', 'Руль, педали и крепёж', 'Проверьте крепление руля, выноса, седла и педалей.'),
        def('identity', 'Серийный номер и происхождение', 'Сверьте видимый серийный номер с доступными документами; не публикуйте личные данные.'),
        def('history', 'История обслуживания', 'Уточните падения, заменённые детали, когда менялись расходники.')
      ])
    })
  });
  const CATEGORY_IDS = Object.freeze(Object.keys(categories));
  const STATUS = Object.freeze({ ok: 'Работает / замечаний нет', issue: 'Есть дефект / замечание', unknown: 'Не проверено' });
  function resolveCategory(value) { return Object.prototype.hasOwnProperty.call(categories, value) ? value : 'smartphone'; }
  function getCategory(value) { return categories[resolveCategory(value)]; }
  function getChecks(value) { return getCategory(value).checks; }
  function clean(value, max = 180) { return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max); }
  function normalize(raw, category) {
    const state = Object.create(null);
    getChecks(category).forEach(check => {
      const input = raw && typeof raw === 'object' && !Array.isArray(raw) && Object.prototype.hasOwnProperty.call(raw, check.id) && raw[check.id] && typeof raw[check.id] === 'object' && !Array.isArray(raw[check.id]) ? raw[check.id] : {};
      state[check.id] = { status: Object.prototype.hasOwnProperty.call(STATUS, input.status) ? input.status : 'unknown', note: clean(input.note, 180) };
    });
    return state;
  }
  function summarize(raw, category) {
    const checks = getChecks(category), state = normalize(raw, category);
    const result = { total: checks.length, filled: 0, ok: 0, issue: 0, unknown: 0, criticalIssues: [], criticalUnknown: [] };
    checks.forEach(check => {
      const status = state[check.id].status;
      result[status]++;
      if (status !== 'unknown') result.filled++;
      if (check.critical && status === 'issue') result.criticalIssues.push(check.id);
      if (check.critical && status === 'unknown') result.criticalUnknown.push(check.id);
    });
    return result;
  }
  function compare(sellerRaw, buyerRaw, category) {
    const checks = getChecks(category), seller = normalize(sellerRaw, category), buyer = normalize(buyerRaw, category);
    const result = { checked: 0, matches: 0, mismatches: [], unconfirmed: [], criticalMismatches: [], buyerIssues: [], buyerCriticalIssues: [] };
    checks.forEach(check => {
      const a = seller[check.id].status, b = buyer[check.id].status;
      if (b === 'unknown') return;
      result.checked++;
      if (b === 'issue') { result.buyerIssues.push(check.id); if (check.critical) result.buyerCriticalIssues.push(check.id); }
      if (a === 'unknown') { result.unconfirmed.push(check.id); return; }
      if (a !== b) { result.mismatches.push(check.id); if (check.critical) result.criticalMismatches.push(check.id); }
      else result.matches++;
    });
    return result;
  }
  function normalizeVoltCheck(raw) { return normalize(raw && typeof raw === 'object' && raw.state ? raw.state : raw, 'smartphone'); }
  function report(meta, sellerRaw, buyerRaw, date) {
    const category = resolveCategory(meta && meta.category), checks = getChecks(category);
    const seller = normalize(sellerRaw, category), buyer = normalize(buyerRaw, category), diff = compare(seller, buyer, category);
    const model = clean(meta && meta.model, 100) || 'Не указана', priceRaw = Number(meta && meta.price);
    const price = Number.isFinite(priceRaw) && priceRaw > 0 && priceRaw <= 100000000 ? Math.round(priceRaw).toLocaleString('ru-RU') + ' ₸' : 'Не указана';
    const created = date instanceof Date && !Number.isNaN(date.valueOf()) ? date : new Date();
    const lines = [
      'VOLTSTORE / VOLTPASSPORT',
      'Сведения продавца и самостоятельная проверка покупателя',
      `Категория: ${getCategory(category).label}`,
      `Товар: ${model}`,
      `Цена в объявлении: ${price}`,
      `Дата: ${created.toLocaleString('ru-RU')}`,
      '',
      `Несовпадений: ${diff.mismatches.length}; критических несовпадений: ${diff.criticalMismatches.length}; непроверенных покупателем: ${checks.length - diff.checked}.`,
      ''
    ];
    checks.forEach(check => {
      const s = seller[check.id], b = buyer[check.id];
      lines.push(`${check.critical ? '[ВАЖНО] ' : ''}${check.title}`);
      lines.push(`  Продавец (со своих слов): ${STATUS[s.status]}${s.note ? ' · ' + s.note : ''}`);
      lines.push(`  Покупатель (самостоятельно): ${STATUS[b.status]}${b.note ? ' · ' + b.note : ''}`);
    });
    lines.push('', 'НЕ СЕРТИФИКАТ. Отметки продавца не проверены VoltStore и могут быть неточными.',
      'Покупатель отвечает за собственную проверку. Сервис не гарантирует состояние товара и безопасность сделки.',
      'Не включайте в отчёт полные IMEI, номера документов и контактные данные.');
    return lines.join('\n');
  }
  // Preserve v1 contract so smartphone demo and existing tests keep working.
  root.VoltPassportCore = Object.freeze({ CATEGORIES: categories, CATEGORY_IDS, CHECKS: categories.smartphone.checks, STATUS, getCategory, getChecks, resolveCategory, clean, normalize, summarize, compare, normalizeVoltCheck, report });
})(typeof window !== 'undefined' ? window : globalThis);
