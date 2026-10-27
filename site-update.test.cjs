'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const prepare = require('./prepare-site.cjs');
const source = fs.readFileSync(path.join(__dirname, 'site-update.js'), 'utf8');
const oldVersion = '1'.repeat(64);
const newVersion = '2'.repeat(64);
const flush = () => new Promise(resolve => setImmediate(resolve));

async function checkSharing() {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const script = Array.from(html.matchAll(/<script>([\s\S]*?)<\/script>/g), match => match[1]).find(code => code.includes('function shareData()'));
  assert.ok(script, 'test the actual native, WhatsApp and copy-link handlers');
  for (const native of [true, false]) {
    for (const version of [oldVersion, newVersion, 'development', undefined]) {
      const elements = new Map();
      const events = {};
      const shared = [];
      const copied = [];
      const element = id => {
        if (!elements.has(id)) elements.set(id, {
          events: {}, open: false, value: '', href: '',
          addEventListener(event, handler) { this.events[event] = handler; },
          showModal() { this.open = true; }, close() { this.open = false; }, focus() {}, select() {}
        });
        return elements.get(id);
      };
      const context = {
        URL, Date: {now: () => 1793090000000},
        location: {href: 'https://sarai-kz.github.io/sarai/?lang=ru&phone=private&name=private&_sarai_update=old#order'},
        SaraiI18n: {language: 'ru', text: value => value},
        navigator: {clipboard: {writeText: async value => copied.push(value)}},
        document: {
          getElementById: element,
          querySelector: () => version === undefined ? null : {content: version},
          addEventListener: (name, handler) => { events[name] = handler; }
        }
      };
      if (native) context.navigator.share = async data => { shared.push(data); };
      vm.runInNewContext(script, context);
      const expectedVersion = [oldVersion, newVersion].includes(version) ? version : '1793090000000';
      for (const language of ['ru', 'kk']) {
        context.SaraiI18n.language = language;
        events['sarai:languagechange']();
        const expected = 'https://sarai-kz.github.io/sarai/?lang=' + language + '&v=' + expectedVersion;
        assert.equal(element('siteShareUrl').value, expected);
        const whatsapp = new URL(element('siteShareWhatsApp').href);
        assert.equal(whatsapp.origin, 'https://wa.me');
        assert.ok(whatsapp.searchParams.get('text').endsWith('\n' + expected));
        assert.ok(!whatsapp.searchParams.get('text').includes('private'));
        await element('shareSite').events.click();
        if (native) assert.equal(shared.at(-1).url, expected);
        else assert.equal(element('siteShareDialog').open, true);
        await element('copySiteShare').events.click();
        assert.equal(copied.at(-1), expected);
        assert.equal(new URL(expected).hash, '');
        assert.deepEqual(Array.from(new URL(expected).searchParams.keys()), ['lang', 'v']);
      }
    }
  }
}

function app({version = oldVersion, language = 'ru', fields = [], online = true, response} = {}) {
  const ids = new Map();
  function element(id) {
    if (!ids.has(id)) ids.set(id, {
      textContent: '', hidden: false, disabled: false, open: false, attributes: new Set(), events: {},
      addEventListener(event, handler) { this.events[event] = handler; },
      toggleAttribute(name, enabled) { if (enabled) this.attributes.add(name); else this.attributes.delete(name); },
      showModal() { this.open = true; }, close() { this.open = false; }, focus() { this.focused = true; }
    });
    return ids.get(id);
  }
  const events = {};
  const navigations = [];
  const requests = [];
  let timer;
  let now = 100000;
  const context = {
    URL, AbortController,
    Date: {now: () => now},
    navigator: {onLine: online},
    SaraiI18n: {language},
    document: {
      hidden: false,
      getElementById: element,
      querySelector: () => ({content: oldVersion}),
      querySelectorAll: () => fields,
      addEventListener: (event, handler) => { events[event] = handler; }
    },
    window: {
      location: {href: 'https://example.test/sarai/?lang=ru&job=SARAI-001#order', replace: url => navigations.push(url)},
      addEventListener: (event, handler) => { events[event] = handler; }
    },
    fetch: async (url, options) => {
      requests.push({url, options});
      if (context.response) return context.response();
      return {ok: true, json: async () => ({version: context.version})};
    },
    version, response,
    setTimeout: () => 1, clearTimeout: () => {},
    setInterval: (handler, delay) => { assert.equal(delay, 60000); timer = handler; }
  };
  vm.runInNewContext(source, context);
  return {context, element, fields, events, navigations, requests, tick: async () => { now += 60000; await timer(); }};
}

async function main() {
  await checkSharing();
  const current = app();
  await flush();
  assert.equal(current.element('siteUpdateMessage').hidden, true);
  assert.equal(current.navigations.length, 0);
  current.context.version = newVersion;
  await current.tick();
  assert.match(current.element('siteUpdateMessage').textContent, /новая версия/);
  assert.equal(current.element('siteUpdater').attributes.has('data-available'), true);
  assert.equal(current.navigations.length, 0, 'background detection never reloads');
  current.context.SaraiI18n.language = 'kk';
  current.events['sarai:languagechange']();
  assert.equal(current.element('siteRefreshLabel').textContent, 'Жаңарту');
  assert.match(current.element('siteUpdateMessage').textContent, /жаңа нұсқасы/);
  await current.element('refreshSite').events.click();
  const destination = new URL(current.navigations[0]);
  assert.equal(destination.searchParams.get('job'), 'SARAI-001');
  assert.equal(destination.searchParams.get('lang'), 'kk');
  assert.equal(destination.hash, '#order');
  assert.match(destination.searchParams.get('_sarai_update'), new RegExp('^' + newVersion + '\\.'));
  assert.equal(current.requests[0].options.cache, 'no-store');
  assert.equal(new URL(current.requests[0].url).pathname, '/sarai/site-version.json');

  const field = {tagName: 'INPUT', type: 'text', value: 'Клиент', defaultValue: ''};
  const draft = app({version: newVersion, fields: [field]});
  await flush();
  await draft.element('refreshSite').events.click();
  assert.equal(draft.element('siteRefreshConfirm').open, true);
  assert.equal(draft.navigations.length, 0);
  draft.element('cancelSiteRefresh').events.click();
  assert.equal(draft.element('siteRefreshConfirm').open, false);
  assert.equal(field.value, 'Клиент');
  await draft.element('refreshSite').events.click();
  draft.element('confirmSiteRefresh').events.click();
  assert.equal(draft.navigations.length, 1);

  const selection = app({fields: [{tagName: 'SELECT', type: 'select-one', value: 'Плиточник', options: [{value: '', defaultSelected: true}, {value: 'Плиточник'}]}]});
  await flush();
  await selection.element('refreshSite').events.click();
  assert.equal(selection.element('siteRefreshConfirm').open, true);
  selection.context.navigator.onLine = false;
  selection.element('confirmSiteRefresh').events.click();
  assert.equal(selection.navigations.length, 0);
  assert.match(selection.element('siteUpdateMessage').textContent, /Нет интернета/);

  const offline = app({online: false});
  await offline.element('refreshSite').events.click();
  assert.equal(offline.requests.length, 0);
  assert.equal(offline.navigations.length, 0);
  assert.match(offline.element('siteUpdateMessage').textContent, /Нет интернета/);
  assert.equal(offline.element('refreshSite').disabled, false);

  for (const response of [
    async () => { throw new Error('network'); },
    async () => ({ok: false}),
    async () => ({ok: true, json: async () => ({version: '<script>'})})
  ]) {
    const failed = app({response});
    await flush();
    await failed.element('refreshSite').events.click();
    assert.equal(failed.navigations.length, 0);
    assert.match(failed.element('siteUpdateMessage').textContent, /Не удалось/);
  }

  const hidden = app();
  await flush();
  hidden.context.document.hidden = true;
  await hidden.tick();
  assert.equal(hidden.requests.length, 1);
  hidden.context.document.hidden = false;
  hidden.context.version = newVersion;
  await hidden.events.visibilitychange();
  assert.match(hidden.element('siteUpdateMessage').textContent, /новая версия/);

  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'sarai-version-'));
  try {
    const make = (name, script = 'console.log(1)') => {
      const dir = path.join(folder, name);
      fs.mkdirSync(dir);
      fs.writeFileSync(path.join(dir, 'index.html'), '<meta name="sarai-version" content="development"><script src="./app.js?v=old"></script><link rel="stylesheet" href="style.css?v=old"><img src="logo.png"><script src="https://external.test/lib.js"></script>');
      fs.writeFileSync(path.join(dir, 'app.js'), script);
      fs.writeFileSync(path.join(dir, 'style.css'), 'body{color:red}');
      fs.writeFileSync(path.join(dir, 'logo.png'), Buffer.from([1, 2, 3]));
      fs.writeFileSync(path.join(dir, 'masters.json'), '{"masters":[]}');
      return dir;
    };
    const first = make('first');
    const version = prepare(first);
    assert.match(version, /^[a-f0-9]{64}$/);
    assert.equal(JSON.parse(fs.readFileSync(path.join(first, 'site-version.json'))).version, version);
    const html = fs.readFileSync(path.join(first, 'index.html'), 'utf8');
    assert.ok(html.includes('content="' + version + '"'));
    assert.match(html, /app\.js\?v=[a-f0-9]{16}/);
    assert.match(html, /style\.css\?v=[a-f0-9]{16}/);
    assert.match(html, /logo\.png\?v=[a-f0-9]{16}/);
    assert.ok(html.includes('https://external.test/lib.js'));
    assert.equal(prepare(make('same')), version, 'same content produces the same version');
    assert.notEqual(prepare(make('changed', 'console.log(2)')), version);
    const records = make('records');
    fs.writeFileSync(path.join(records, 'masters.json'), '{"masters":[{}]}');
    assert.notEqual(prepare(records), version, 'record changes are detected too');
    const missing = make('missing');
    fs.unlinkSync(path.join(missing, 'app.js'));
    assert.throws(() => prepare(missing), /Missing local asset/);
  } finally { fs.rmSync(folder, {recursive: true, force: true}); }
  console.log('Native, WhatsApp and copied release links; update detection, draft protection, offline handling, navigation and build checks passed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
