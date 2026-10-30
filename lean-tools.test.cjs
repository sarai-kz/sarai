'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const model = require('./lean-model.js');
const {bundle} = require('./build-lean-tools.cjs');

const memory = () => {const values = new Map(); return {getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key)};};
const code = model.generateCode(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]));
assert.equal(code, 'SARAI-ABCDEFGH');
assert.equal(model.normalizeCode(' sarai-abcdefgh '), code);
for (const bad of ['77027935200', 'SARAI-12345678', '<script>', 'SARAI-ABCDEFGH\nINJECT', 'SARAI-ABCDEFGH&phone=private', 'SARAI-ABC']) assert.equal(model.normalizeCode(bad), null);
const saved = memory();
assert.equal(model.receiveCode('https://sarai.test/?ref=' + code, saved), code);
assert.equal(model.receiveCode('https://sarai.test/?lang=ru', saved), code);
assert.equal(model.receiveCode('https://sarai.test/?ref=bad', saved), null);
assert.equal(model.receiveCode('https://sarai.test/', saved), null, 'an invalid new referral must not keep a previous inviter');
assert.equal(model.receiveCode('https://sarai.test/?ref=' + code + '&ref=' + code, saved), null);
const denied = {getItem() {throw new Error('blocked');}, setItem() {throw new Error('blocked');}, removeItem() {throw new Error('blocked');}};
assert.equal(model.receiveCode('https://sarai.test/?ref=' + code, denied), code);
assert.equal(model.getStored(denied, model.ownCodeKey), null);
assert.equal(model.setStored(denied, model.ownCodeKey, code), false);
const invite = new URL(model.inviteUrl(code, 'ru', 'a'.repeat(64)));
assert.equal(invite.origin + invite.pathname, 'https://sarai-kz.github.io/sarai/');
assert.deepEqual(Array.from(invite.searchParams.keys()).sort(), ['lang', 'ref', 'v']);
assert.equal(invite.searchParams.get('ref'), code);
assert.equal(invite.searchParams.get('lang'), 'ru');
assert.throws(() => model.inviteUrl('../private', 'ru'), /code/);
assert.equal(model.referralLine('', code, 'ru'), '');
assert.throws(() => model.referralLine(code, code.toLowerCase(), 'ru'), /self/);
assert.match(model.referralLine(code, null, 'kk'), /SARAI тексереді/);
assert.match(model.referralLine(code, null, 'ru'), /проверяет SARAI/);

const input = {title: 'Әсем пәтер - жөндеу сметасы', author: 'Құрылыс шебері Ғалым', date: '2026-10-30', notes: 'Материалдар мен мерзімді клиентпен келісу.', items: [
  {name: 'Қабырғаны бояу', quantity: '0,333', unit: 'm2', price: '10,05'},
  {name: 'Электр нүктесін орнату', quantity: '2', unit: 'piece', price: '10.10'}
]};
const result = model.estimate(input);
assert.equal(result.items[0].amountCents, 335);
assert.equal(result.totalCents, 2355);
assert.equal(model.scaled('1 500,50', 2, 100000000, true), 150050);
for (const quantity of ['0', '-1', '1e4', 'NaN', 'Infinity', '1.0001', '100001']) assert.throws(() => model.line({...input.items[0], quantity}));
for (const price of ['-1', '10.005', '100000001', 'NaN']) assert.throws(() => model.line({...input.items[0], price}));
assert.throws(() => model.estimate({...input, date: '2026-02-29'}), /date/);
assert.throws(() => model.estimate({...input, items: []}), /rows/);
assert.throws(() => model.estimate({...input, items: Array(51).fill(input.items[0])}), /rows/);
assert.throws(() => model.estimate({...input, items: [{...input.items[0], unit: 'unknown'}]}), /unit/);
assert.throws(() => model.estimate({...input, items: [{...input.items[0], name: ' '}]}), /text/);
assert.equal(model.line({...input.items[0], name: '<img src=x onerror=alert(1)>'}).name, '<img src=x onerror=alert(1)>', 'user-entered names remain literal text, not interpreted markup');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
for (const id of ['orderReferral', 'jobReferral', 'joinReferral', 'estimate-tool', 'invite-tool']) assert.ok(html.includes('id="' + id + '"'));
for (const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
assert.equal(fs.readFileSync(path.join(__dirname, 'site-tools.js'), 'utf8'), bundle(), 'published bundle must exactly match its maintained sources');
new vm.Script(bundle());

const pdf = require('./estimate-pdf.js');
const {jsPDF} = require('./vendor-jspdf.js');
const fonts = require('./pdf-fonts.js');
const options = {jsPDF, fonts};
assert.equal(jsPDF.version, '4.2.1');
const document = pdf.create(input, 'kk', options);
assert.equal(document.data.totalCents, 2355);
assert.equal(document.filename, 'SARAI-smeta-2026-10-30.pdf');
assert.equal(Buffer.from(document.doc.output('arraybuffer')).subarray(0, 5).toString(), '%PDF-');
const long = {...input, notes: 'Клиентпен келісіледі. '.repeat(25), items: Array.from({length: 50}, (_, i) => ({name: 'Қабырғаны дайындау, бұрыштарды түзету және сапалы әрлеу жұмысы ' + (i + 1), quantity: '12.5', unit: 'm2', price: '1500'}))};
const multi = pdf.create(long, 'ru', options);
assert.ok(multi.doc.getNumberOfPages() >= 3, 'long estimates must produce paginated documents');
assert.equal(multi.data.items.length, 50);
console.log('Referral and PDF estimate checks passed');
