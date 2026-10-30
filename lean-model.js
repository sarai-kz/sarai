/* SARAI: validation and calculations shared by the referral and estimate tools. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SaraiLean = api;
}(typeof globalThis === 'undefined' ? this : globalThis, function () {
  'use strict';
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const codePattern = /^SARAI-[A-HJ-NP-Z2-9]{8}$/;
  const ownCodeKey = 'sarai-invite-code-v1';
  const receivedCodeKey = 'sarai-received-invite-v1';
  const units = Object.freeze({m2: 'м²', metre: 'м.п.', piece: 'дана', set: 'жиынтық', hour: 'сағат'});
  const limits = Object.freeze({rows: 50, title: 100, author: 80, name: 160, notes: 600, totalCents: 100000000000000});
  function normalizeCode(value) {
    if (typeof value !== 'string') return null;
    const code = value.trim().toUpperCase();
    return codePattern.test(code) ? code : null;
  }
  function generateCode(randomBytes) {
    if (!(randomBytes instanceof Uint8Array) || randomBytes.length < 8) throw new Error('random');
    return 'SARAI-' + Array.from(randomBytes.slice(0, 8), n => alphabet[n & 31]).join('');
  }
  function getStored(store, key) {
    try { return normalizeCode(store.getItem(key)); } catch (error) { return null; }
  }
  function setStored(store, key, code) {
    try { if (code) store.setItem(key, code); else store.removeItem(key); return true; } catch (error) { return false; }
  }
  function receiveCode(urlText, store) {
    const url = new URL(urlText);
    const values = url.searchParams.getAll('ref');
    if (values.length) {
      const code = values.length === 1 ? normalizeCode(values[0]) : null;
      setStored(store, receivedCodeKey, code);
      return code;
    }
    return getStored(store, receivedCodeKey);
  }
  function inviteUrl(code, language, version) {
    const normalized = normalizeCode(code);
    if (!normalized) throw new Error('code');
    const url = new URL('https://sarai-kz.github.io/sarai/');
    url.searchParams.set('lang', language === 'ru' ? 'ru' : 'kk');
    if (/^[a-f0-9]{64}$/.test(version || '')) url.searchParams.set('v', version);
    url.searchParams.set('ref', normalized);
    return url.href;
  }
  function referralLine(value, ownCode, language) {
    if (typeof value !== 'string' || !value.trim()) return '';
    const code = normalizeCode(value);
    if (!code) throw new Error('code');
    if (code === normalizeCode(ownCode)) throw new Error('self');
    return (language === 'ru' ? 'Код пригласившего (проверяет SARAI): ' : 'Шақырған адамның коды (SARAI тексереді): ') + code;
  }
  function scaled(value, precision, maximum, allowZero) {
    const text = String(value ?? '').trim().replace(/[\s\u00a0\u202f]/g, '').replace(',', '.');
    if (!new RegExp('^\\d{1,12}(?:\\.\\d{1,' + precision + '})?$').test(text)) throw new Error('number');
    const [integer, fraction = ''] = text.split('.');
    const result = Number(integer) * 10 ** precision + Number(fraction.padEnd(precision, '0'));
    if (!Number.isSafeInteger(result) || result > maximum * 10 ** precision || result < (allowZero ? 0 : 1)) throw new Error('number');
    return result;
  }
  function plain(value, maximum, required) {
    if (typeof value !== 'string') throw new Error('text');
    const text = value.normalize('NFC').replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, ' ').trim();
    if (text.length > maximum || required && !text) throw new Error('text');
    return text;
  }
  function line(item) {
    if (!item || !Object.hasOwn(units, item.unit)) throw new Error('unit');
    const name = plain(item.name, limits.name, true);
    const quantityMilli = scaled(item.quantity, 3, 100000, false);
    const priceCents = scaled(item.price, 2, 100000000, true);
    // Integer arithmetic avoids losing tiyn on fractional quantities.
    const amountCents = Number((BigInt(quantityMilli) * BigInt(priceCents) + 500n) / 1000n);
    if (!Number.isSafeInteger(amountCents) || amountCents > limits.totalCents) throw new Error('total');
    return {name, unit: item.unit, quantity: quantityMilli / 1000, price: priceCents / 100, amountCents};
  }
  function date(value) {
    if (typeof value !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(value)) throw new Error('date');
    const parsed = new Date(value + 'T12:00:00Z');
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error('date');
    return value;
  }
  function estimate(input) {
    if (!input || !Array.isArray(input.items) || !input.items.length || input.items.length > limits.rows) throw new Error('rows');
    const items = input.items.map(line);
    const totalCents = items.reduce((sum, item) => sum + item.amountCents, 0);
    if (!Number.isSafeInteger(totalCents) || totalCents > limits.totalCents) throw new Error('total');
    return {title: plain(input.title, limits.title, true), author: plain(input.author || '', limits.author, false), notes: plain(input.notes || '', limits.notes, false), date: date(input.date), items, totalCents};
  }
  return Object.freeze({alphabet, codePattern, ownCodeKey, receivedCodeKey, normalizeCode, generateCode, getStored, setStored, receiveCode, inviteUrl, referralLine, units, limits, scaled, line, estimate});
}));
