(function () {
  'use strict';
  const model = SaraiMasters;
  const element = id => document.getElementById(id);
  const listState = {records: [], status: 'loading'};
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    node.className = className;
    node.textContent = text;
    return node;
  };
  Object.entries(model.trades).forEach(([value, trade]) => {
    const option = make('option', '', trade.label);
    option.value = value;
    element('masterTrade').append(option);
  });
  function card(record) {
    const trade = model.trades[record.trade];
    const article = make('article', 'card master-card', '');
    article.id = 'master-' + record.id;
    article.append(make('span', 'pill', record.city), make('h3', '', record.name), make('p', 'master-trade', trade.label));
    if (record.description) article.append(make('p', 'master-description', record.description));
    const actions = make('div', 'actions master-actions', '');
    const order = make('button', 'btn order-link', 'Осы шеберге өтінім');
    order.type = 'button';
    order.setAttribute('aria-label', record.name + ' шеберіне SARAI арқылы өтінім беру');
    order.addEventListener('click', () => selectMaster({id: record.id, name: record.name, trade: trade.service}));
    actions.append(order);
    article.append(actions);
    return article;
  }
  function render() {
    const query = model.search(element('masterSearch').value).split(' ').filter(Boolean);
    const trade = element('masterTrade').value;
    const active = listState.records.filter(record => record.active);
    const records = active.filter(record => {
      const aliases = record.trade === 'levkas' ? 'левкасшы левкасшик левкасщик' : '';
      const text = model.search([record.name, record.description, model.trades[record.trade].label, aliases].join(' '));
      return (trade === 'all' || record.trade === trade) && query.every(word => text.includes(word));
    });
    const ready = listState.status === 'ready';
    element('masterResults').replaceChildren(...(ready ? records.map(card) : []));
    element('noMasters').hidden = !ready || records.length > 0;
    element('noMastersText').textContent = active.length ? 'Бұл іздеу бойынша шебер табылмады. Басқа сөзбен іздеңіз немесе мамандық сүзгісін өзгертіңіз.' : 'Әзірге жарияланған шебер жоқ. Тапсырысыңызды SARAI-ға қалдыра аласыз.';
    element('mastersLoading').hidden = listState.status !== 'loading';
    element('mastersError').hidden = listState.status !== 'error';
    element('masterCount').textContent = ready ? records.length + ' шебер табылды' : listState.status === 'error' ? 'Тізім жүктелмеді' : 'Шеберлер жүктелуде…';
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
    render();
  }
  element('masterSearch').addEventListener('input', render);
  element('masterTrade').addEventListener('change', render);
  element('clearMasterSearch').addEventListener('click', clear);
  element('clearEmptySearch').addEventListener('click', clear);
  element('retryMasters').addEventListener('click', load);
  load();
}());

