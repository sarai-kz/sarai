(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SaraiMasters = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const trades = Object.freeze({
    levkas: {label: 'Левкас шебері', service: 'Левкас жұмыстары'},
    electrician: {label: 'Электрик', service: 'Электрик'},
    plumber: {label: 'Сантехник', service: 'Сантехник'},
    finisher: {label: 'Әрлеу шебері', service: 'Әрлеу жұмыстары'},
    tile: {label: 'Плитка шебері', service: 'Плитка жұмыстары'},
    painter: {label: 'Маляр', service: 'Маляр жұмыстары'},
    drywall: {label: 'Гипсокартон шебері', service: 'Гипсокартон'},
    renovation: {label: 'Пәтер жөндеу', service: 'Толық пәтер жөндеу'},
    other: {label: 'Басқа жөндеу жұмыстары', service: 'Басқа жөндеу'}
  });
  const fields = ['id', 'name', 'city', 'trade', 'description', 'active'];
  const phoneInText = /\+?[78](?:[\s().-]*\d){10}(?!\d)|(?:^|\D)7\d{2}[\s().-]*\d{3}[\s().-]*\d{2}[\s().-]*\d{2}(?!\d)/;
  const otherContactInText = /(?:https?:\/\/|www\.|wa\.me\/|t\.me\/|[\w.+-]+@[\w.-]+\.[a-z]{2,})/i;
  const containsContact = value => phoneInText.test(value) || otherContactInText.test(value);
  function text(value, min, max, label) {
    if (typeof value !== 'string') throw new Error(label + ' енгізіңіз.');
    const result = value.trim();
    if (result.length < min || result.length > max) throw new Error(label + ': ' + min + '–' + max + ' таңба енгізіңіз.');
    return result;
  }
  function master(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Шебер мәліметтері дұрыс емес.');
    if (Object.keys(value).some(key => !fields.includes(key))) throw new Error('Артық мәліметтерді алып тастаңыз.');
    if (typeof value.id !== 'string' || !/^[a-z0-9][a-z0-9-]{2,63}$/.test(value.id)) throw new Error('Шебер нөмірі дұрыс емес.');
    const name = text(value.name, 2, 60, 'Аты-жөні');
    if (!/^[\p{L}\p{M}\d .’'()-]+$/u.test(name)) throw new Error('Аты-жөніне әріптер мен бос орын енгізіңіз.');
    if (value.city !== 'Астана' || !Object.prototype.hasOwnProperty.call(trades, value.trade)) throw new Error('Қала немесе мамандық дұрыс емес.');
    const description = text(value.description, 0, 240, 'Қысқаша сипаттама');
    if ([name, description].some(containsContact)) throw new Error('Байланыс нөмірлері мен сілтемелерді WhatsApp-та жеке сақтаңыз.');
    if (typeof value.active !== 'boolean') throw new Error('Көріну күйі дұрыс емес.');
    return {id: value.id, name, city: 'Астана', trade: value.trade, description, active: value.active};
  }
  function feed(value) {
    if (!value || value.version !== 2 || !Array.isArray(value.masters) || value.masters.length > 500) throw new Error('Шеберлер тізімін оқу мүмкін болмады.');
    const seen = new Set();
    const masters = value.masters.map(record => {
      if (!record || typeof record !== 'object' || Object.keys(record).some(key => ![...fields, 'updated_at', 'last_request'].includes(key))) throw new Error('Шебер жазбасы дұрыс емес.');
      const core = master(Object.fromEntries(fields.map(key => [key, record[key]])));
      if (seen.has(core.id)) throw new Error('Қайталанған шебер нөмірі.');
      seen.add(core.id);
      if (typeof record.updated_at !== 'string' || !Number.isFinite(Date.parse(record.updated_at))) throw new Error('Жаңарту уақыты дұрыс емес.');
      if (record.last_request !== null && (!Number.isSafeInteger(record.last_request) || record.last_request <= 0)) throw new Error('Өзгеріс нөмірі дұрыс емес.');
      return {...core, updated_at: record.updated_at, last_request: record.last_request};
    });
    return {version: 2, masters};
  }
  function search(value) {
    const map = {'ұ':'у','ү':'у','і':'и','ә':'а','ң':'н','ө':'о','ғ':'г','қ':'к','ё':'е'};
    return value.toLowerCase().replace(/[ұүіәңөғқё]/g, letter => map[letter]).replace(/[^a-zа-я0-9]+/g, ' ').trim();
  }
  function request(record, expectedUpdatedAt) {
    return {version: 2, action: 'upsert', expected_updated_at: expectedUpdatedAt, master: master(record)};
  }
  function issueUrl(payload) {
    const record = master(payload.master);
    const operation = record.active ? 'жариялау' : 'жасыру';
    const title = '[SARAI] Шеберді ' + operation + ': ' + record.name;
    const body = 'Шеберлер тізімін жаңарту.\n\n[Басқаруға оралу](https://sarai-kz.github.io/sarai/admin.html)\n\n<!-- SARAI_MASTER_REQUEST_V2 -->\n```json\n' + JSON.stringify(payload) + '\n```\n<!-- END_SARAI_MASTER_REQUEST -->';
    const url = new URL('https://github.com/sarai-kz/sarai/issues/new');
    url.searchParams.set('title', title);
    url.searchParams.set('body', body);
    if (url.href.length > 7500) throw new Error('Сипаттаманы қысқартып көріңіз.');
    return url.href;
  }
  return Object.freeze({trades, master, feed, search, request, issueUrl});
}));

