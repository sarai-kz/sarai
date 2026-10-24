(function () {
  'use strict';
  const byId = id => document.getElementById(id);
  const t = SaraiI18n.text;
  const model = SaraiJobs;
  const openJobs = () => boardState.jobs.filter(job => job.status === 'open');
  const boardState = {jobs: [], status: 'loading', hasLoaded: false, refreshing: false, refreshError: false};
  const jobIdPattern = /^SARAI-[A-Z0-9-]{3,60}$/i;
  const notificationReadKey = 'sarai-read-jobs-v1';
  function loadReadJobIds() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(notificationReadKey) || 'null');
      if (saved && saved.version === 1 && Array.isArray(saved.read) && saved.read.length <= 500) {
        return new Set(saved.read.filter(id => typeof id === 'string' && jobIdPattern.test(id)));
      }
    } catch (error) { /* A blocked or damaged store must not prevent viewing jobs. */ }
    return new Set();
  }
  let readJobIds = loadReadJobIds();
  let notificationListKey = '';
  let returnNotificationFocus = true;
  function saveReadJobIds() {
    try {
      window.localStorage.setItem(notificationReadKey, JSON.stringify({version: 1, read: Array.from(readJobIds)}));
    } catch (error) { /* Read state still works for this page when storage is unavailable. */ }
  }
  const phoneInPublicText = /\+?[78](?:[\s().-]*\d){10}(?!\d)|(?:^|\D)7\d{2}[\s().-]*\d{3}[\s().-]*\d{2}[\s().-]*\d{2}(?!\d)/;
  const otherContactInPublicText = /(?:https?:\/\/|www\.|wa\.me\/|t\.me\/|[\w.+-]+@[\w.-]+\.[a-z]{2,})/i;
  const containsContact = value => phoneInPublicText.test(value) || otherContactInPublicText.test(value);
  const cleanText = value => value.replace(/\r\n?/g, '\n').trim();
  const normalizedWords = value => {
    const letters = {'ұ':'у','ү':'у','і':'и','ә':'а','ң':'н','ө':'о','ғ':'г','қ':'к','ё':'е'};
    return value.toLowerCase().replace(/[ұүіәңөғқё]/g, letter => letters[letter]).replace(/[^a-zа-я0-9]+/g, ' ').trim();
  };

  const offerState = {job: null, trigger: null};
  const offerFields = ['offerName', 'offerPhone', 'offerSpecialty', 'offerProposal', 'offerStart'];
  function jobUrl(job) {
    const url = new URL('https://sarai-kz.github.io/sarai/');
    url.searchParams.set('lang', SaraiI18n.language);
    url.hash = 'job-' + job.id;
    return url.href;
  }
  function invalidateOffer() {
    byId('jobOfferPrepared').hidden = true;
    byId('sendOfferWhatsApp').removeAttribute('href');
    byId('jobOfferMessage').value = '';
    byId('offerCopyStatus').textContent = '';
    byId('offerUnavailable').hidden = true;
    byId('offerUnavailable').textContent = '';
  }
  function offerUnavailable() {
    invalidateOffer();
    byId('offerUnavailable').textContent = t('Бұл жұмысқа қазір ұсыныс жіберу мүмкін емес. Тізімді жаңартыңыз.');
    byId('offerUnavailable').hidden = false;
  }
  function refreshOfferContext() {
    const job = offerState.job;
    if (job) byId('jobOfferContext').textContent = job.id + ' · ' + SaraiI18n.title(job);
  }
  function openOffer(job, trigger) {
    offerState.job = job;
    offerState.trigger = trigger;
    byId('jobOfferForm').reset();
    offerFields.forEach(id => byId(id).setCustomValidity(''));
    invalidateOffer();
    refreshOfferContext();
    byId('jobOfferDialog').showModal();
    byId('jobOfferDialog').scrollTop = 0;
    byId('offerName').focus({preventScroll: true});
  }
  function currentOfferJob() {
    return offerState.job && boardState.jobs.find(job => job.id === offerState.job.id && job.status === 'open');
  }
  function refreshOfferMessage() {
    const job = currentOfferJob();
    if (!job) return false;
    offerState.job = job;
    refreshOfferContext();
    const message = [
      t('SARAI — шебердің ұсынысы'),
      t('Дереккөз: SARAI сайты'),
      t('Жұмыс нөмірі:') + ' ' + job.id,
      t('Жұмыс:') + ' ' + SaraiI18n.title(job),
      t('Қала: Астана') + (job.district ? ' · ' + job.district : ''),
      t('Қызмет:') + ' ' + t(job.service),
      t('Жұмыс сілтемесі:') + ' ' + jobUrl(job),
      '',
      t('Шебердің аты-жөні:') + ' ' + cleanText(byId('offerName').value),
      t('Шебердің телефоны:') + ' ' + normalizePhone(byId('offerPhone').value),
      t('Мамандығым:') + ' ' + cleanText(byId('offerSpecialty').value),
      t('Ұсынысым:') + ' ' + cleanText(byId('offerProposal').value),
      t('Бос уақытым:') + ' ' + cleanText(byId('offerStart').value)
    ].join('\n');
    byId('jobOfferMessage').value = message;
    byId('sendOfferWhatsApp').href = 'https://wa.me/' + saraiContact.phone + '?text=' + encodeURIComponent(message);
    return true;
  }
  function validateOffer() {
    byId('offerName').setCustomValidity(cleanText(byId('offerName').value) ? '' : t('Аты-жөніңізді енгізіңіз.'));
    byId('offerPhone').setCustomValidity(normalizePhone(byId('offerPhone').value) ? '' : t('Телефон нөмірін толық енгізіңіз: +7 7xx xxx xx xx.'));
    byId('offerSpecialty').setCustomValidity(cleanText(byId('offerSpecialty').value).length >= 2 ? '' : t('Мамандығыңызды енгізіңіз.'));
    byId('offerProposal').setCustomValidity(cleanText(byId('offerProposal').value).length >= 10 ? '' : t('Ұсынысыңызды кемінде 10 таңбамен жазыңыз.'));
    byId('offerStart').setCustomValidity(cleanText(byId('offerStart').value).length >= 2 ? '' : t('Қашан бастай алатыныңызды жазыңыз.'));
    return byId('jobOfferForm').reportValidity();
  }
  byId('jobOfferForm').addEventListener('input', event => {
    if (typeof event.target.setCustomValidity === 'function') event.target.setCustomValidity('');
    invalidateOffer();
  });
  byId('jobOfferForm').addEventListener('change', invalidateOffer);
  byId('jobOfferForm').addEventListener('submit', event => {
    event.preventDefault();
    invalidateOffer();
    if (!validateOffer()) return;
    if (!refreshOfferMessage()) {
      offerUnavailable();
      byId('offerUnavailable').scrollIntoView({block: 'nearest'});
      return;
    }
    byId('jobOfferPrepared').hidden = false;
    byId('jobOfferPreparedTitle').focus({preventScroll: true});
    byId('jobOfferPrepared').scrollIntoView({behavior: 'smooth', block: 'start'});
  });
  byId('sendOfferWhatsApp').addEventListener('click', event => {
    if (!validateOffer() || !refreshOfferMessage()) {
      event.preventDefault();
      if (!currentOfferJob()) offerUnavailable();
      else invalidateOffer();
    }
  });
  byId('copyOffer').addEventListener('click', () => {
    if (!validateOffer()) return;
    if (!refreshOfferMessage()) { offerUnavailable(); return; }
    copyText(byId('jobOfferMessage'), 'offerCopyStatus');
  });
  byId('closeJobOffer').addEventListener('click', () => byId('jobOfferDialog').close());
  byId('jobOfferDialog').addEventListener('close', () => {
    if (offerState.trigger && offerState.trigger.isConnected) offerState.trigger.focus({preventScroll: true});
    byId('jobOfferForm').reset();
    invalidateOffer();
    offerState.job = null;
    offerState.trigger = null;
  });

  function invalidateJobRequest() {
    byId('jobPrepared').hidden = true;
    byId('sendJobWhatsApp').removeAttribute('href');
    byId('jobCopyStatus').textContent = '';
  }

  function validatePublicText(id, minimum, label) {
    const field = byId(id);
    const value = cleanText(field.value);
    let message = '';
    if (value.length < minimum) message = t('{label} кемінде {count} таңба болуы керек.',{label:t(label),count:minimum});
    if (containsContact(value)) message = t('Телефон мен сілтемені осы өріске қоспаңыз. Телефонды бөлек өріске енгізіңіз.');
    field.setCustomValidity(message);
    return value;
  }

  byId('postJobForm').addEventListener('input', event => {
    if (typeof event.target.setCustomValidity === 'function') event.target.setCustomValidity('');
    invalidateJobRequest();
  });
  byId('postJobForm').addEventListener('change', invalidateJobRequest);
  function prepareJobRequest() {
    const name = cleanText(byId('jobCustomer').value);
    const phone = normalizePhone(byId('jobPhone').value);
    byId('jobCustomer').setCustomValidity(name ? '' : t('Атыңызды енгізіңіз.'));
    byId('jobPhone').setCustomValidity(phone ? '' : t('Телефон нөмірін толық енгізіңіз: +7 7xx xxx xx xx.'));
    const description = validatePublicText('jobDescription', 20, 'Жұмыс сипаттамасы');
    const district = validatePublicText('jobDistrict', 0, 'Аудан атауы');
    if (!byId('postJobForm').reportValidity()) return false;
    const service = byId('jobService').value;
    const title = (t(service) + (district ? ' · ' + district : '')).slice(0, 100);
    const area = byId('jobArea').value === '' ? null : Number(byId('jobArea').value);
    const budget = byId('jobBudget').value === '' ? null : Number(byId('jobBudget').value);
    const start = byId('jobStart').value;
    const publicLines = [t('Жұмыс:') + ' ' + title, t('Қала: Астана'), t('Қызмет:') + ' ' + t(service)];
    if (district) publicLines.push(t('Аудан / тұрғын үй кешені:') + ' ' + district);
    publicLines.push(t('Ауданы:') + ' ' + (area === null ? t('Нақтыланады') : formatNumber(area) + ' м²'));
    publicLines.push(t('Жұмыс бюджеті:') + ' ' + (budget === null ? t('Келісімді') : money(budget)));
    publicLines.push(t('Бастау мерзімі:') + ' ' + t(start), '', t('Сипаттама:') + ' ' + description);
    const message = [t('SARAI — жұмыс жариялау өтінімі'), t('Өтінім нөмірі:') + ' ' + requestReference('J'), '', t('Байланыс мәліметтері (ашық тізімге қоспау):'), t('Аты:') + ' ' + name, t('Телефон:') + ' ' + phone, '', t('Жариялауға арналған мәліметтер:'), ...publicLines, '', t('Клиенттің аты мен телефонын жарияламай, тексергеннен кейін жұмыс тізіміне қосуды сұраймын.')].join('\n');
    byId('jobPreviewTitle').textContent = title;
    byId('jobPreviewMeta').textContent = ['Астана', area === null ? '' : formatNumber(area) + ' м²', budget === null ? t('Бюджет: келісімді') : money(budget), t(start)].filter(Boolean).join(' · ');
    byId('jobPreviewDescription').textContent = description;
    byId('jobMessage').value = message;
    byId('sendJobWhatsApp').href = 'https://wa.me/' + saraiContact.phone + '?text=' + encodeURIComponent(message);
    byId('jobPrepared').hidden = false;
    return true;
  }
  byId('postJobForm').addEventListener('submit', event => {
    event.preventDefault();
    if (!prepareJobRequest()) return;
    byId('jobPreparedTitle').focus({preventScroll: true});
    byId('jobPrepared').scrollIntoView({behavior: 'smooth', block: 'nearest'});
  });
  byId('copyJob').addEventListener('click', () => copyText(byId('jobMessage'), 'jobCopyStatus'));


  function textElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text;
    return element;
  }

  function publicJobDate(job, includeTime) {
    const parts = new Intl.DateTimeFormat('en-GB', {day: '2-digit', month: '2-digit', year: 'numeric', ...(includeTime ? {hour: '2-digit', minute: '2-digit'} : {}), timeZone: 'Asia/Almaty'}).formatToParts(new Date(job.published_at));
    const part = type => parts.find(value => value.type === type).value;
    return ['day', 'month', 'year'].map(part).join('.') + (includeTime ? ' · ' + part('hour') + ':' + part('minute') : '');
  }

  function renderNotifications() {
    const unread = boardState.hasLoaded ? openJobs().filter(job => !readJobIds.has(job.id)).length : 0;
    const badge = byId('jobNotificationBadge');
    badge.hidden = unread === 0;
    badge.textContent = unread > 99 ? '99+' : String(unread);
    byId('jobNotifications').setAttribute('aria-label', t(unread ? 'Шеберге хабарламалар: {count} жаңа тапсырыс' : 'Шеберге хабарламалар', {count: unread}));
    byId('jobNotifications').title = t('Шеберге хабарламалар');
    const announcement = boardState.hasLoaded ? t(unread ? 'Жаңа тапсырыс: {count}' : 'Жаңа тапсырыс жоқ.', {count: unread}) : '';
    if (byId('jobNotificationStatus').textContent !== announcement) byId('jobNotificationStatus').textContent = announcement;
    if (!byId('jobNotificationsDialog').open) return;
    let feedback;
    if (!boardState.hasLoaded) feedback = t(boardState.status === 'error' ? 'Хабарламаларды жүктеу мүмкін болмады. Қайта көріңіз.' : 'Хабарламалар жүктелуде…');
    else if (boardState.refreshing) feedback = t('Жаңа жұмыстар тексерілуде…');
    else if (boardState.refreshError) feedback = t('Жаңарту сәтсіз. Соңғы жүктелген жұмыстар көрсетіліп тұр.');
    else if (!openJobs().length) feedback = t('Әзірге жарияланған жұмыс жоқ');
    else feedback = t(unread ? 'Жаңа тапсырыс: {count}' : 'Барлық хабарлама қаралды.', {count: unread});
    byId('jobNotificationsFeedback').textContent = feedback;
    byId('readAllJobNotifications').disabled = unread === 0;
    const listKey = JSON.stringify([SaraiI18n.language, openJobs(), Array.from(readJobIds).sort()]);
    if (notificationListKey === listKey) return;
    notificationListKey = listKey;
    const jobs = openJobs().slice().sort((a, b) => Number(!readJobIds.has(b.id)) - Number(!readJobIds.has(a.id)) || Date.parse(b.published_at) - Date.parse(a.published_at));
    const items = jobs.map(job => {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.className = 'notification-job';
      link.href = '#job-' + job.id;
      link.dataset.notificationJob = job.id;
      link.dataset.unread = String(!readJobIds.has(job.id));
      link.setAttribute('aria-label', t('{title} жұмысын ашу', {title: SaraiI18n.title(job)}));
      const heading = textElement('span', 'notification-job-title', '');
      heading.append(textElement('strong', '', SaraiI18n.title(job)));
      if (!readJobIds.has(job.id)) heading.append(textElement('span', 'notification-new', t('Жаңа')));
      const details = [job.city, job.district, job.budget === null ? t('Бюджет: келісімді') : money(job.budget)].filter(Boolean).join(' · ');
      const date = textElement('time', 'notification-date', publicJobDate(job, true));
      date.dateTime = job.published_at;
      link.append(heading, textElement('span', 'notification-meta', details), date);
      item.append(link);
      return item;
    });
    byId('jobNotificationList').replaceChildren(...items);
  }

  function clearJobFilters() {
    byId('jobSearch').value = '';
    byId('jobServiceFilter').value = 'all';
    byId('jobSort').value = 'newest';
    byId('jobStatusFilter').value = 'open';
    renderJobs();
  }

  function updateJobLoadState() {
    byId('jobBoard').setAttribute('aria-busy', String(boardState.refreshing));
    byId('refreshJobs').disabled = boardState.refreshing;
    byId('refreshJobNotifications').disabled = boardState.refreshing;
    byId('jobRefreshNotice').hidden = !boardState.refreshError;
    byId('jobRefreshNotice').textContent = boardState.refreshError ? t('Жаңарту сәтсіз. Соңғы жүктелген жұмыстар көрсетіліп тұр.') : '';
  }

  function renderJob(job) {
    const card = document.createElement('article');
    card.className = 'card job-card';
    card.id = 'job-' + job.id;
    const meta = document.createElement('div');
    meta.className = 'job-meta';
    meta.append(textElement('span', 'pill', job.city), textElement('span', 'pill', t(job.service)), textElement('span', 'pill job-status-' + job.status, t(model.statuses[job.status])));
    card.append(meta, textElement('h3', '', SaraiI18n.title(job)), textElement('p', 'job-description', job.description));
    const facts = document.createElement('dl');
    facts.className = 'job-facts';
    const entries = [['Аудан / тұрғын үй кешені', job.district || t('Нақтыланады')], ['Ауданы', job.area === null ? t('Нақтыланады') : formatNumber(job.area) + ' м²'], ['Жұмыс бюджеті', job.budget === null ? t('Келісімді') : money(job.budget)], ['Бастау мерзімі', t(job.start)]];
    entries.forEach(([label, value]) => {
      const item = document.createElement('div');
      item.append(textElement('dt', '', t(label)), textElement('dd', '', value));
      facts.append(item);
    });
    card.append(facts, textElement('p', 'job-date', job.id + ' · ' + publicJobDate(job, false)));
    const actions = document.createElement('div');
    actions.className = 'actions';
    if (job.status === 'open') {
    const offer = textElement('button', 'btn whatsapp', t('Осы жұмысқа ұсыныс беру'));
    offer.type = 'button';
    offer.setAttribute('aria-haspopup', 'dialog');
    offer.setAttribute('aria-label', t('{title} жұмысына ұсыныс беру',{title:SaraiI18n.title(job)}));
    offer.addEventListener('click', () => openOffer(job, offer));
    actions.append(offer);
    }
    const share = textElement('button', 'btn alt small', t('Жұмыс сілтемесін көшіру'));
    share.type = 'button';
    const shared = textElement('p', 'copy-status', ''); shared.setAttribute('role', 'status');
    const linkField = document.createElement('input'); linkField.readOnly = true; linkField.hidden = true; linkField.setAttribute('aria-label', t('Жұмыс сілтемесі'));
    share.addEventListener('click', async () => {
      const url = jobUrl(job);
      try { await navigator.clipboard.writeText(url); shared.textContent = t('Жұмыс сілтемесі көшірілді.'); }
      catch (error) { linkField.value = url; linkField.hidden = false; linkField.focus(); linkField.select(); shared.textContent = t('Сілтемені қолмен көшіріңіз.'); }
    });
    actions.append(share); card.append(linkField, shared);

    card.append(actions);
    return card;
  }

  function renderJobs() {
    const ready = boardState.status === 'ready';
    const words = normalizedWords(byId('jobSearch').value).split(' ').filter(Boolean);
    const service = byId('jobServiceFilter').value;
    const status = byId('jobStatusFilter').value;
    const jobs = boardState.jobs.filter(job => {
      const text = normalizedWords([job.title, SaraiI18n.title(job), job.description, job.service, t(job.service), job.city, job.district].join(' '));
      return (service === 'all' || job.service === service) && (status === 'all' || job.status === status) && words.every(word => text.includes(word));
    }).sort((a, b) => byId('jobSort').value === 'budget' ? (b.budget || 0) - (a.budget || 0) || Date.parse(b.published_at) - Date.parse(a.published_at) : Date.parse(b.published_at) - Date.parse(a.published_at));
    byId('jobResults').replaceChildren(...(ready ? jobs.map(renderJob) : []));
    byId('jobsLoading').hidden = boardState.status !== 'loading';
    byId('jobsError').hidden = boardState.status !== 'error';
    byId('jobsEmpty').hidden = !ready || boardState.jobs.length > 0;
    byId('jobsNoMatch').hidden = !ready || boardState.jobs.length === 0 || jobs.length > 0;
    updateJobLoadState();
    byId('jobCount').textContent = ready ? t('{count} жұмыс көрсетілді',{count:jobs.length}) + (jobs.length !== boardState.jobs.length ? ' / ' + t('барлығы {count}',{count:boardState.jobs.length}) : '') : t(boardState.status === 'error' ? 'Жұмыстар жүктелмеді' : 'Жұмыстар жүктелуде…');
  }

  async function loadJobs() {
    if (boardState.refreshing) return;
    const firstLoad = !boardState.hasLoaded;
    boardState.refreshing = true;
    if (!boardState.hasLoaded) {
      boardState.status = 'loading';
      renderJobs();
    }
    updateJobLoadState();
    renderNotifications();
    let changed = !boardState.hasLoaded;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch('./data/jobs.json', {cache: 'no-store', signal: controller.signal});
      if (!response.ok) throw new Error('Job feed unavailable');
      const data = await response.json();
      const jobs = model.feed(data).jobs;
      changed = changed || JSON.stringify(boardState.jobs) !== JSON.stringify(jobs);
      boardState.jobs = jobs;
      boardState.status = 'ready';
      boardState.hasLoaded = true;
      boardState.refreshError = false;
      if (offerState.job) {
        const job = currentOfferJob();
        if (!job) {
          offerUnavailable();
        } else {
          offerState.job = job;
          refreshOfferContext();
          if (!byId('jobOfferPrepared').hidden) refreshOfferMessage();
        }
      }
      const activeIds = new Set(openJobs().map(job => job.id));
      const readCount = readJobIds.size;
      readJobIds = new Set(Array.from(readJobIds).filter(id => activeIds.has(id)));
      if (readJobIds.size !== readCount) saveReadJobIds();
    } catch (error) {
      if (boardState.hasLoaded) {
        boardState.refreshError = true;
      } else {
        boardState.jobs = [];
        boardState.status = 'error';
        changed = true;
      }
    } finally {
      clearTimeout(timeout);
      boardState.refreshing = false;
      if (changed) renderJobs();
      if (firstLoad && boardState.hasLoaded) revealLinkedJob();
      updateJobLoadState();
      renderNotifications();
    }
  }

  function revealLinkedJob() {
    if (!location.hash.startsWith('#job-') || !boardState.hasLoaded) return;
    const id = location.hash.slice(5);
    const job = boardState.jobs.find(item => item.id === id);
    byId('jobLinkNotice').hidden = Boolean(job);
    byId('jobLinkNotice').textContent = job ? '' : t('Бұл нөмірдегі жұмыс табылмады. Барлық жұмысты қарап көріңіз.');
    if (!job) return;
    byId('jobSearch').value = ''; byId('jobServiceFilter').value = 'all'; byId('jobStatusFilter').value = job.status;
    renderJobs();
    const card = byId('job-' + job.id); card.tabIndex = -1; card.focus({preventScroll:true}); card.scrollIntoView({block:'start'});
  }
  window.addEventListener('hashchange', revealLinkedJob);
  byId('jobStatusFilter').addEventListener('change', renderJobs);
  byId('jobSearch').addEventListener('input', renderJobs);
  byId('jobServiceFilter').addEventListener('change', renderJobs);
  byId('jobSort').addEventListener('change', renderJobs);
  byId('refreshJobs').addEventListener('click', loadJobs);
  byId('retryJobs').addEventListener('click', loadJobs);
  byId('clearJobFilters').addEventListener('click', clearJobFilters);
  byId('jobNotifications').addEventListener('click', () => {
    byId('jobNotificationsDialog').showModal();
    renderNotifications();
    loadJobs();
  });
  byId('closeJobNotifications').addEventListener('click', () => byId('jobNotificationsDialog').close());
  byId('jobNotificationsDialog').addEventListener('close', () => {
    if (returnNotificationFocus) byId('jobNotifications').focus({preventScroll: true});
    returnNotificationFocus = true;
  });
  byId('refreshJobNotifications').addEventListener('click', loadJobs);
  byId('readAllJobNotifications').addEventListener('click', () => {
    openJobs().forEach(job => readJobIds.add(job.id));
    saveReadJobIds();
    renderNotifications();
  });
  byId('jobNotificationList').addEventListener('click', event => {
    const link = event.target.closest('a[data-notification-job]');
    if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button) return;
    const id = link.dataset.notificationJob;
    if (!openJobs().some(job => job.id === id)) return;
    event.preventDefault();
    readJobIds.add(id);
    saveReadJobIds();
    renderNotifications();
    clearJobFilters();
    returnNotificationFocus = false;
    byId('jobNotificationsDialog').close();
    const card = byId('job-' + id);
    card.tabIndex = -1;
    window.location.hash = card.id;
    card.focus({preventScroll: true});
    card.scrollIntoView({block: 'start'});
  });
  byId('viewAllNotificationJobs').addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button) return;
    clearJobFilters();
    returnNotificationFocus = false;
    byId('jobNotificationsDialog').close();
    byId('jobsTitle').tabIndex = -1;
    byId('jobsTitle').focus({preventScroll: true});
  });
  document.addEventListener('sarai:languagechange', () => {
    renderJobs();
    renderNotifications();
    if (!byId('jobPrepared').hidden) prepareJobRequest();
    byId('jobCopyStatus').textContent = '';
    refreshOfferContext();
    if (!byId('jobOfferPrepared').hidden) {
      if (!refreshOfferMessage()) offerUnavailable();
      else byId('offerCopyStatus').textContent = '';
    }
    if (!byId('offerUnavailable').hidden) byId('offerUnavailable').textContent = t('Бұл жұмысқа қазір ұсыныс жіберу мүмкін емес. Тізімді жаңартыңыз.');
  });
  window.addEventListener('storage', event => {
    if (event.key !== notificationReadKey && event.key !== null) return;
    readJobIds = loadReadJobIds();
    renderNotifications();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') loadJobs();
  });
  window.addEventListener('online', loadJobs);
  setInterval(() => {
    if (document.visibilityState === 'visible') loadJobs();
  }, 60000);
  loadJobs();
}());

