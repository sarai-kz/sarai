(function () {
  'use strict';
  const model = SaraiMasters;
  const t = SaraiI18n.text;
  const element = id => document.getElementById(id);
  const favoritesKey = 'sarai-favorite-masters-v1';
  function readFavorites() {
    try { const ids = JSON.parse(localStorage.getItem(favoritesKey) || '[]'); return new Set(Array.isArray(ids) ? ids.slice(0,500).filter(id => typeof id === 'string' && /^[a-z0-9][a-z0-9-]{2,63}$/.test(id)) : []); }
    catch (error) { return new Set(); }
  }
  let favorites = readFavorites();
  const aliases = {levkas:'левкасшы левкасшик левкасщик шпаклевка', electrician:'электрик электрика жарық розетка', plumber:'сантехник сантехника құбыр', tile:'плитка кафель плиточник', painter:'маляр бояу покраска', drywall:'гипсокартон', carpenter:'плотник столяр ағаш ұстасы', finisher:'отделка әрлеу', renovation:'ремонт жөндеу', other:'басқа другие'};
  const pageSize = 3;
  const listState = {records: [], status: 'loading', page: 1};
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    node.className = className;
    node.textContent = text;
    return node;
  };
  Object.entries(model.trades).forEach(([value, trade]) => {
    const option = make('option', '', t(trade.label));
    option.value = value;
    element('masterTrade').append(option);
  });
  function card(record) {
    const trade = model.trades[record.trade];
    const article = make('article', 'card master-card', '');
    article.id = 'master-' + record.id;
    article.append(make('span', 'pill', record.city), make('h3', '', record.name), make('p', 'master-trade', t(trade.label)));
    if (record.description) article.append(make('p', 'master-description', t(record.description)));
    const actions = make('div', 'actions master-actions', '');
    const order = make('button', 'btn order-link', t('Осы шеберге өтінім'));
    order.type = 'button';
    order.setAttribute('aria-label', t('{name} шеберіне SARAI арқылы өтінім беру',{name:record.name}));
    order.addEventListener('click', () => selectMaster({id: record.id, name: record.name, trade: trade.service}));
    const favorite = make('button', 'btn alt small favorite-button', t(favorites.has(record.id) ? '♥ Таңдаулыда' : '♡ Таңдаулыға'));
    favorite.type = 'button'; favorite.id = 'favorite-' + record.id;
    favorite.setAttribute('aria-pressed', String(favorites.has(record.id)));
    favorite.setAttribute('aria-label', t('{name}: таңдаулыға сақтау', {name:record.name}));
    favorite.addEventListener('click', () => {
      if (favorites.has(record.id)) favorites.delete(record.id); else favorites.add(record.id);
      try {localStorage.setItem(favoritesKey,JSON.stringify([...favorites])); element('favoritesStatus').textContent=t('Таңдаулылар осы браузерде сақталды.');}
      catch(error){element('favoritesStatus').textContent=t('Сақтау қолжетімсіз. Таңдаулылар осы бетте ғана қалады.');}
      render(); (document.getElementById(favorite.id) || element('masterFavorites')).focus();
    });
    actions.append(order, favorite);
    article.append(actions);
    return article;
  }
  function render() {
    const query = model.search(element('masterSearch').value).split(' ').filter(Boolean);
    const trade = element('masterTrade').value;
    const active = listState.records.filter(record => record.active);
    const records = active.filter(record => {

      const text = model.search([record.name, record.description, t(record.description), model.trades[record.trade].label, t(model.trades[record.trade].label), aliases[record.trade] || ''].join(' '));
      return (trade === 'all' || record.trade === trade) && (!element('masterFavorites').checked || favorites.has(record.id)) && query.every(word => text.includes(word));
    });
    const ready = listState.status === 'ready';
    const pageCount = Math.max(1, Math.ceil(records.length / pageSize));
    listState.page = Math.max(1, Math.min(listState.page, pageCount));
    const start = (listState.page - 1) * pageSize;
    const pageRecords = records.slice(start, start + pageSize);
    element('masterResults').replaceChildren(...(ready ? pageRecords.map(card) : []));
    element('masterPagination').hidden = !ready || pageCount <= 1;
    element('previousMasterPage').disabled = listState.page <= 1;
    element('nextMasterPage').disabled = listState.page >= pageCount;
    element('masterPageStatus').textContent = t('{page} / {pages} бет', {page: listState.page, pages: pageCount});
    element('noMasters').hidden = !ready || records.length > 0;
    element('noMastersText').textContent = t(element('masterFavorites').checked && !favorites.size ? 'Алдымен шебер карточкасындағы жүрекшені басып сақтаңыз.' : active.length ? 'Бұл іздеу бойынша шебер табылмады. Басқа сөзбен іздеңіз немесе мамандық сүзгісін өзгертіңіз.' : 'Әзірге жарияланған шебер жоқ. Тапсырысыңызды SARAI-ға қалдыра аласыз.');
    element('mastersLoading').hidden = listState.status !== 'loading';
    element('mastersError').hidden = listState.status !== 'error';
    element('masterCount').textContent = ready ? t(records.length > pageSize ? '{count} шебер табылды · {start}–{end} көрсетілді' : '{count} шебер табылды', {count: records.length, start: start + 1, end: start + pageRecords.length}) : t(listState.status === 'error' ? 'Тізім жүктелмеді' : 'Шеберлер жүктелуде…');
    element('masterResults').setAttribute('aria-busy', String(listState.status === 'loading'));
  }
  async function load() {
    listState.status = 'loading';
    render();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch('./masters.json?t=' + Date.now(), {cache: 'no-store', signal: controller.signal});
      if (!response.ok) throw new Error('Unable to load masters');
      listState.records = model.feed(await response.json()).masters;
      listState.status = 'ready';
    } catch (error) {
      listState.status = 'error';
    } finally {
      clearTimeout(timeout);
      render();
    }
  }
  function clear() {
    element('masterSearch').value = '';
    element('masterTrade').value = 'all';
    element('masterFavorites').checked = false;
    listState.page = 1;
    render();
  }
  function filter() {
    listState.page = 1;
    render();
  }
  function changePage(direction) {
    if (listState.status !== 'ready') return;
    listState.page += direction;
    render();
    element('masterResults').focus({preventScroll: true});
    element('masterResults').scrollIntoView({behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start'});
  }
  element('previousMasterPage').addEventListener('click', () => changePage(-1));
  element('nextMasterPage').addEventListener('click', () => changePage(1));
  element('masterFavorites').addEventListener('change', filter);
  window.addEventListener('storage', event => {if (event.key === favoritesKey || event.key === null) {favorites = readFavorites(); render();}});
  element('masterSearch').addEventListener('input', filter);
  element('masterTrade').addEventListener('change', filter);
  element('clearMasterSearch').addEventListener('click', clear);
  element('clearEmptySearch').addEventListener('click', clear);
  element('retryMasters').addEventListener('click', load);
  document.addEventListener('sarai:languagechange', () => {
    Array.from(element('masterTrade').options).forEach(option => {
      if (model.trades[option.value]) option.textContent = t(model.trades[option.value].label);
    });
    render();
  });
  load();
}());

