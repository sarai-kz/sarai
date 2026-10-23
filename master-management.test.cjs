'use strict';
const assert = require('node:assert/strict');
const model = require('./master-model.js');
const {parseBody, applyRequest} = require('./manage-masters.cjs');
const original = require('./masters.json');
const owner = {ownerLogin: 'sarai-kz', ownerId: 345260523, authorLogin: 'sarai-kz', authorId: 345260523, actor: 'sarai-kz', repository: 'sarai-kz/sarai', issueNumber: 11};
const record = {id: 'm-test-alpha', name: 'Сынақ шебер', city: 'Астана', trade: 'electrician', description: 'Электр жұмыстары.', active: true};
const create = model.request(record, null);
const snapshot = JSON.stringify(original);
const added = applyRequest(original, create, owner, '2026-10-23T10:00:00.000Z');
assert.equal(added.feed.masters.length, original.masters.length + 1);
assert.equal(added.feed.version, 2);
assert.equal(added.feed.masters.some(master => 'phone' in master), false, 'Public master records must not contain phone fields');
assert.equal(JSON.stringify(original), snapshot, 'Input feed must not be mutated');
for (const identity of [
  {...owner, actor: 'visitor'}, {...owner, authorId: 1}, {...owner, authorLogin: 'visitor'},
  {...owner, ownerId: undefined, authorId: undefined}, {...owner, repository: 'visitor/sarai'}, {...owner, ownerLogin: 'visitor'}
]) assert.throws(() => applyRequest(original, create, identity), /Only the repository owner/);
const newRecord = added.feed.masters.at(-1);
const editPayload = model.request({...record, description: 'Розетка және жарық орнату.'}, newRecord.updated_at);
const edited = applyRequest(added.feed, editPayload, {...owner, issueNumber: 12}, '2026-10-23T10:01:00.000Z');
assert.equal(edited.feed.masters.at(-1).description, 'Розетка және жарық орнату.');
assert.throws(() => applyRequest(edited.feed, editPayload, {...owner, issueNumber: 13}), /Reload the management page/);
assert.throws(() => applyRequest(edited.feed, create, {...owner, issueNumber: 14}), /Reload the management page/);
const retry = applyRequest(edited.feed, editPayload, {...owner, issueNumber: 12});
assert.equal(retry.changed, false, 'A retried issue must be idempotent');
assert.deepEqual(retry.feed, edited.feed);
const hidden = applyRequest(edited.feed, model.request({...record, active: false}, edited.feed.masters.at(-1).updated_at), {...owner, issueNumber: 15}, '2026-10-23T10:02:00.000Z');
assert.equal(hidden.feed.masters.at(-1).active, false);
const restored = applyRequest(hidden.feed, model.request(record, hidden.feed.masters.at(-1).updated_at), {...owner, issueNumber: 16}, '2026-10-23T10:03:00.000Z');
assert.equal(restored.feed.masters.at(-1).active, true);
assert.throws(() => applyRequest(original, {...create, destination: 'index.html'}, owner), /Invalid request action/);
assert.throws(() => model.master({...record, trade: '__proto__'}), /мамандық/);
assert.throws(() => model.master({...record, token: 'must-not-be-accepted'}), /Артық/);
assert.throws(() => model.master({...record, active: 'true'}), /күйі/);
assert.throws(() => model.master({...record, phone: '77000000000'}), /Артық/);
assert.throws(() => applyRequest(original, {...create, version: 1}, owner), /Invalid request action/);
for (const contact of ['+7 (700) 000-00-00', '87000000000', '700 000 00 00', 'https://example.com', 'wa.me/77000000000', 'test@example.com']) {
  assert.throws(() => model.master({...record, description: 'Электр жұмыстары. ' + contact}), /WhatsApp/, 'Public descriptions must reject contacts: ' + contact);
}
assert.throws(() => model.master({...record, name: 'Шебер 77000000000'}), /WhatsApp/);
assert.throws(() => model.feed({...original, masters: [{...original.masters[0], phone: '77000000000'}]}), /дұрыс емес/);
assert.throws(() => model.master({...record, name: '@someone'}), /Аты-жөні/);
assert.throws(() => model.feed({version: 2, masters: [original.masters[0], original.masters[0]]}), /Қайталанған/);
assert.throws(() => applyRequest(added.feed, model.request({...record, id: 'm-duplicate'}, null), {...owner, issueNumber: 17}), /already exists/);
const tricky = model.request({...record, description: 'HTML <b>мәтіні</b> және ``` белгісі.'}, null);
const url = new URL(model.issueUrl(tricky));
assert.equal(url.origin, 'https://github.com');
assert.equal(url.pathname, '/sarai-kz/sarai/issues/new');
assert.deepEqual(parseBody(url.searchParams.get('body')), tricky);
assert.throws(() => parseBody('invalid payload'), /Missing/);
assert.equal('phone' in parseBody(url.searchParams.get('body')).master, false, 'Public GitHub publication requests must not contain phone fields');
console.log('Master management checks passed: owner authorization, updates, visibility, stale writes, retries, contact privacy, validation and request encoding.');

