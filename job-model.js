(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./master-model.js'));
  else root.SaraiJobs = factory(root.SaraiMasters);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (masters) {
  'use strict';
  const services = Object.freeze([...new Set(Object.values(masters.trades).map(trade => trade.service))]);
  const statuses = Object.freeze({open: 'Шебер ізделуде', in_progress: 'Орындалып жатыр', closed: 'Аяқталды'});
  const starts = Object.freeze(['Келісеміз', 'Мүмкіндігінше тез', 'Бір апта ішінде', 'Бір ай ішінде']);
  const fields = ['id', 'status', 'city', 'service', 'title', 'description', 'district', 'area', 'budget', 'start', 'published_at'];
  const idPattern = /^SARAI-[A-Z0-9-]{3,60}$/i;
  const contact = /\+?[78](?:[\s().-]*\d){10}(?!\d)|(?:^|\D)7\d{2}[\s().-]*\d{3}[\s().-]*\d{2}[\s().-]*\d{2}(?!\d)|(?:https?:\/\/|www\.|wa\.me\/|t\.me\/|[\w.+-]+@[\w.-]+\.[a-z]{2,})/i;
  const timestamp = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
  function text(value, min, max) {
    if (typeof value !== 'string') throw new Error('Мәтін өрістерін тексеріңіз.');
    const result = value.replace(/\r\n?/g, '\n').trim();
    if (result.length < min || result.length > max) throw new Error('Мәтін ұзындығын тексеріңіз.');
    if (contact.test(result)) throw new Error('Клиенттің телефоны мен сілтемелерін ашық сипаттамаға қоспаңыз.');
    return result;
  }
  function job(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => ![...fields, 'updated_at', 'last_request'].includes(key))) throw new Error('Тапсырыс өрістері дұрыс емес.');
    if (typeof value.id !== 'string' || !idPattern.test(value.id)) throw new Error('Тапсырыс нөмірі дұрыс емес.');
    if (!Object.hasOwn(statuses, value.status) || value.city !== 'Астана' || !services.includes(value.service) || !starts.includes(value.start)) throw new Error('Қала, қызмет немесе мәртебе дұрыс емес.');
    const title = text(value.title, 8, 100);
    const description = text(value.description, 20, 1200);
    const district = text(value.district ?? '', 0, 80);
    if (value.area != null && (typeof value.area !== 'number' || !Number.isFinite(value.area) || value.area < 1 || value.area > 10000)) throw new Error('Ауданы 1–10 000 м² болуы керек.');
    if (value.budget != null && (!Number.isSafeInteger(value.budget) || value.budget < 1 || value.budget > 100000000)) throw new Error('Бюджетті тексеріңіз.');
    if (!timestamp(value.published_at) || (value.updated_at !== undefined && !timestamp(value.updated_at))) throw new Error('Жариялау уақыты дұрыс емес.');
    if (value.last_request !== undefined && (!Number.isSafeInteger(value.last_request) || value.last_request < 1)) throw new Error('Өзгеріс нөмірі дұрыс емес.');
    return {id: value.id, status: value.status, city: 'Астана', service: value.service, title, description, district, area: value.area ?? null, budget: value.budget ?? null, start: value.start, published_at: value.published_at, ...(value.updated_at === undefined ? {} : {updated_at: value.updated_at}), ...(value.last_request === undefined ? {} : {last_request: value.last_request})};
  }
  function feed(value) {
    if (!value || Object.keys(value).some(key => !['version', 'jobs'].includes(key)) || value.version !== 1 || !Array.isArray(value.jobs) || value.jobs.length > 500) throw new Error('Тапсырыстар тізімі дұрыс емес.');
    const jobs = value.jobs.map(job);
    if (new Set(jobs.map(item => item.id)).size !== jobs.length) throw new Error('Тапсырыс нөмірі қайталанған.');
    return {version: 1, jobs};
  }
  const revision = record => record ? record.updated_at || record.published_at : null;
  const core = value => Object.fromEntries(fields.map(key => [key, job(value)[key]]));
  function request(record, expectedUpdatedAt) {
    if (expectedUpdatedAt !== null && !timestamp(expectedUpdatedAt)) throw new Error('Алдыңғы нұсқа дұрыс емес. Тізімді жаңартыңыз.');
    return {version: 1, action: 'upsert', expected_updated_at: expectedUpdatedAt, job: core(record)};
  }
  function issueUrl(payload) {
    const clean = request(payload.job, payload.expected_updated_at);
    const json = JSON.stringify(clean);
    const encoded = typeof Buffer === 'function' ? Buffer.from(json, 'utf8').toString('base64') : btoa(String.fromCharCode(...new TextEncoder().encode(json)));
    const body = 'Ашық тапсырысты жаңарту. Клиенттің жеке байланыс деректері қосылмайды.\n\n[Басқаруға оралу](https://sarai-kz.github.io/sarai/admin-jobs.html)\n\n<!-- SARAI_JOB_REQUEST_V1 -->\n```base64\n' + encoded + '\n```\n<!-- END_SARAI_JOB_REQUEST -->';
    const url = new URL('https://github.com/sarai-kz/sarai/issues/new');
    url.searchParams.set('title', '[SARAI] Тапсырыс: ' + clean.job.id);
    url.searchParams.set('body', body);
    if (url.href.length > 7800) throw new Error('Сипаттаманы қысқартып, қайта көріңіз.');
    return url.href;
  }
  return Object.freeze({services, statuses, starts, fields, idPattern, job, feed, core, revision, request, issueUrl});
}));
