(function () {
  'use strict';
  const byId = id => document.getElementById(id);
  const boardState = {jobs: [], status: 'loading'};
  const serviceNames = new Set(Array.from(byId('jobService').options).map(option => option.value).filter(Boolean));
  const startChoices = new Set(Array.from(byId('jobStart').options).map(option => option.value));
  const publicFields = new Set(['id', 'status', 'city', 'service', 'title', 'description', 'district', 'area', 'budget', 'start', 'published_at']);
  const phoneInPublicText = /\+?[78](?:[\s().-]*\d){10}(?!\d)|(?:^|\D)7\d{2}[\s().-]*\d{3}[\s().-]*\d{2}[\s().-]*\d{2}(?!\d)/;
  const otherContactInPublicText = /(?:https?:\/\/|www\.|wa\.me\/|t\.me\/|[\w.+-]+@[\w.-]+\.[a-z]{2,})/i;
  const containsContact = value => phoneInPublicText.test(value) || otherContactInPublicText.test(value);
  const cleanText = value => value.replace(/\r\n?/g, '\n').trim();
  const normalizedWords = value => {
    const letters = {'ұ':'у','ү':'у','і':'и','ә':'а','ң':'н','ө':'о','ғ':'г','қ':'к','ё':'е'};
    return value.toLowerCase().replace(/[ұүіәңөғқё]/g, letter => letters[letter]).replace(/[^a-zа-я0-9]+/g, ' ').trim();
  };

  function invalidateJobRequest() {
    byId('jobPrepared').hidden = true;
    byId('sendJobWhatsApp').removeAttribute('href');
    byId('jobCopyStatus').textContent = '';
  }

  function validatePublicText(id, minimum, label) {
    const field = byId(id);
    const value = cleanText(field.value);
    let message = '';
    if (value.length < minimum) message = label + ' кемінде ' + minimum + ' таңба болуы керек.';
    if (containsContact(value)) message = 'Телефон мен сілтемені осы өріске қоспаңыз. Телефонды бөлек өріске енгізіңіз.';
    field.setCustomValidity(message);
    return value;
  }

  byId('postJobForm').addEventListener('input', event => {
    if (typeof event.target.setCustomValidity === 'function') event.target.setCustomValidity('');
    invalidateJobRequest();
  });
  byId('postJobForm').addEventListener('change', invalidateJobRequest);
  byId('postJobForm').addEventListener('submit', event => {
    event.preventDefault();
    const name = cleanText(byId('jobCustomer').value);
    const phone = normalizePhone(byId('jobPhone').value);
    byId('jobCustomer').setCustomValidity(name ? '' : 'Атыңызды енгізіңіз.');
    byId('jobPhone').setCustomValidity(phone ? '' : 'Телефон нөмірін толық енгізіңіз: +7 7xx xxx xx xx.');
    const title = validatePublicText('jobTitle', 8, 'Жұмыс атауы');
    const description = validatePublicText('jobDescription', 20, 'Жұмыс сипаттамасы');
    const district = validatePublicText('jobDistrict', 0, 'Аудан атауы');
    if (!byId('postJobForm').reportValidity()) return;
    const service = byId('jobService').value;
    const area = byId('jobArea').value === '' ? null : Number(byId('jobArea').value);
    const budget = byId('jobBudget').value === '' ? null : Number(byId('jobBudget').value);
    const start = byId('jobStart').value;
    const publicLines = ['Жұмыс: ' + title, 'Қала: Астана', 'Қызмет: ' + service];
    if (district) publicLines.push('Аудан / тұрғын үй кешені: ' + district);
    publicLines.push('Ауданы: ' + (area === null ? 'Нақтыланады' : formatNumber(area) + ' м²'));
    publicLines.push('Жұмыс бюджеті: ' + (budget === null ? 'Келісімді' : money(budget)));
    publicLines.push('Бастау мерзімі: ' + start, '', 'Сипаттама: ' + description);
    const message = ['SARAI — жұмыс жариялау өтінімі', '', 'Байланыс мәліметтері (ашық тізімге қоспау):', 'Аты: ' + name, 'Телефон: ' + phone, '', 'Жариялауға арналған мәліметтер:', ...publicLines, '', 'Клиенттің аты мен телефонын жарияламай, тексергеннен кейін жұмыс тізіміне қосуды сұраймын.'].join('\n');
    byId('jobPreviewTitle').textContent = title;
    byId('jobPreviewMeta').textContent = ['Астана', service, district, area === null ? '' : formatNumber(area) + ' м²', budget === null ? 'Бюджет: келісімді' : money(budget), start].filter(Boolean).join(' · ');
    byId('jobPreviewDescription').textContent = description;
    byId('jobMessage').value = message;
    byId('sendJobWhatsApp').href = 'https://wa.me/' + saraiContact.phone + '?text=' + encodeURIComponent(message);
    byId('jobPrepared').hidden = false;
    byId('jobPreparedTitle').focus({preventScroll: true});
    byId('jobPrepared').scrollIntoView({behavior: 'smooth', block: 'nearest'});
  });
  byId('copyJob').addEventListener('click', () => copyText(byId('jobMessage'), 'jobCopyStatus'));

  function readPublicJob(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid job record');
    if (Object.keys(raw).some(key => !publicFields.has(key))) throw new Error('Unexpected public field');
    if (typeof raw.id !== 'string' || !/^SARAI-[A-Z0-9-]{3,60}$/i.test(raw.id)) throw new Error('Invalid job ID');
    if (!['open', 'closed'].includes(raw.status) || raw.city !== 'Астана' || !serviceNames.has(raw.service)) throw new Error('Invalid job category');
    const title = typeof raw.title === 'string' ? cleanText(raw.title) : '';
    const description = typeof raw.description === 'string' ? cleanText(raw.description) : '';
    const district = raw.district == null ? '' : typeof raw.district === 'string' ? cleanText(raw.district) : null;
    if (title.length < 8 || title.length > 100 || description.length < 20 || description.length > 1200 || district === null || district.length > 80) throw new Error('Invalid job text');
    if ([title, description, district].some(containsContact)) throw new Error('Contact in public job');
    if (raw.area != null && (typeof raw.area !== 'number' || !Number.isFinite(raw.area) || raw.area < 1 || raw.area > 10000)) throw new Error('Invalid job area');
    if (raw.budget != null && (typeof raw.budget !== 'number' || !Number.isInteger(raw.budget) || raw.budget < 1 || raw.budget > 100000000)) throw new Error('Invalid job budget');
    if (!startChoices.has(raw.start) || typeof raw.published_at !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(raw.published_at) || !Number.isFinite(Date.parse(raw.published_at))) throw new Error('Invalid job date');
    return {id: raw.id, status: raw.status, city: raw.city, service: raw.service, title, description, district, area: raw.area == null ? null : raw.area, budget: raw.budget == null ? null : raw.budget, start: raw.start, published_at: raw.published_at};
  }

  function textElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text;
    return element;
  }

  function renderJob(job) {
    const card = document.createElement('article');
    card.className = 'card job-card';
    card.id = 'job-' + job.id;
    const meta = document.createElement('div');
    meta.className = 'job-meta';
    meta.append(textElement('span', 'pill', job.city), textElement('span', 'pill', job.service));
    card.append(meta, textElement('h3', '', job.title), textElement('p', 'job-description', job.description));
    const facts = document.createElement('dl');
    facts.className = 'job-facts';
    const entries = [['Аудан / тұрғын үй кешені', job.district || 'Нақтыланады'], ['Ауданы', job.area === null ? 'Нақтыланады' : formatNumber(job.area) + ' м²'], ['Жұмыс бюджеті', job.budget === null ? 'Келісімді' : money(job.budget)], ['Бастау мерзімі', job.start]];
    entries.forEach(([label, value]) => {
      const item = document.createElement('div');
      item.append(textElement('dt', '', label), textElement('dd', '', value));
      facts.append(item);
    });
    const dateParts = new Intl.DateTimeFormat('en-GB', {day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Almaty'}).formatToParts(new Date(job.published_at));
    const date = ['day', 'month', 'year'].map(type => dateParts.find(part => part.type === type).value).join('.');
    card.append(facts, textElement('p', 'job-date', job.id + ' · ' + date));
    const actions = document.createElement('div');
    actions.className = 'actions';
    const offer = textElement('a', 'btn whatsapp', 'Осы жұмысқа ұсыныс беру');
    offer.target = '_blank';
    offer.rel = 'noopener noreferrer';
    offer.setAttribute('aria-label', job.title + ' жұмысына ұсыныс беру');
    const message = ['Сәлеметсіз бе! SARAI сайтындағы жұмысқа ұсыныс бергім келеді.', 'Жұмыс нөмірі: ' + job.id, 'Жұмыс: ' + job.title, 'Қызмет: ' + job.service, '', 'Мамандығым: ', 'Ұсынысым: ', 'Бос уақытым: '].join('\n');
    offer.href = 'https://wa.me/' + saraiContact.phone + '?text=' + encodeURIComponent(message);
    actions.append(offer);
    card.append(actions);
    return card;
  }

  function renderJobs() {
    const ready = boardState.status === 'ready';
    const words = normalizedWords(byId('jobSearch').value).split(' ').filter(Boolean);
    const service = byId('jobServiceFilter').value;
    const jobs = boardState.jobs.filter(job => {
      const text = normalizedWords([job.title, job.description, job.service, job.city, job.district].join(' '));
      return (service === 'all' || job.service === service) && words.every(word => text.includes(word));
    }).sort((a, b) => byId('jobSort').value === 'budget' ? (b.budget || 0) - (a.budget || 0) || Date.parse(b.published_at) - Date.parse(a.published_at) : Date.parse(b.published_at) - Date.parse(a.published_at));
    byId('jobResults').replaceChildren(...(ready ? jobs.map(renderJob) : []));
    byId('jobsLoading').hidden = boardState.status !== 'loading';
    byId('jobsError').hidden = boardState.status !== 'error';
    byId('jobsEmpty').hidden = !ready || boardState.jobs.length > 0;
    byId('jobsNoMatch').hidden = !ready || boardState.jobs.length === 0 || jobs.length > 0;
    byId('jobBoard').setAttribute('aria-busy', String(boardState.status === 'loading'));
    byId('refreshJobs').disabled = boardState.status === 'loading';
    byId('jobCount').textContent = ready ? jobs.length + ' жұмыс көрсетілді' + (jobs.length !== boardState.jobs.length ? ' / барлығы ' + boardState.jobs.length : '') : boardState.status === 'error' ? 'Жұмыстар жүктелмеді' : 'Жұмыстар жүктелуде…';
  }

  async function loadJobs() {
    if (boardState.status === 'loading' && byId('refreshJobs').disabled) return;
    boardState.status = 'loading';
    renderJobs();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch('./data/jobs.json', {cache: 'no-store', signal: controller.signal});
      if (!response.ok) throw new Error('Job feed unavailable');
      const data = await response.json();
      if (!data || data.version !== 1 || !Array.isArray(data.jobs) || data.jobs.length > 500) throw new Error('Invalid job feed');
      const jobs = data.jobs.map(readPublicJob);
      if (new Set(jobs.map(job => job.id)).size !== jobs.length) throw new Error('Duplicate job ID');
      boardState.jobs = jobs.filter(job => job.status === 'open');
      boardState.status = 'ready';
    } catch (error) {
      boardState.jobs = [];
      boardState.status = 'error';
    } finally {
      clearTimeout(timeout);
      renderJobs();
    }
  }

  byId('jobSearch').addEventListener('input', renderJobs);
  byId('jobServiceFilter').addEventListener('change', renderJobs);
  byId('jobSort').addEventListener('change', renderJobs);
  byId('refreshJobs').addEventListener('click', loadJobs);
  byId('retryJobs').addEventListener('click', loadJobs);
  byId('clearJobFilters').addEventListener('click', () => {
    byId('jobSearch').value = '';
    byId('jobServiceFilter').value = 'all';
    byId('jobSort').value = 'newest';
    renderJobs();
  });
  loadJobs();
}());
