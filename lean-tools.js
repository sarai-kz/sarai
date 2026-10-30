(function () {
  'use strict';
  const model = SaraiLean;
  const byId = id => document.getElementById(id);
  const t = SaraiI18n.text;
  function store(name) { try { return window[name]; } catch (error) { return null; } }
  const local = store('localStorage'), session = store('sessionStorage');
  let ownCode = model.getStored(local, model.ownCodeKey);
  let incomingCode = model.receiveCode(window.location.href, session);
  if (incomingCode && incomingCode === ownCode) { incomingCode = null; model.setStored(session, model.receivedCodeKey, null); }
  const referralFields = ['orderReferral', 'jobReferral', 'joinReferral'];
  referralFields.forEach(id => {
    const field = byId(id);
    field.value = incomingCode || ''; field.defaultValue = field.value;
    field.addEventListener('input', () => {field.value = field.value.toUpperCase(); field.setCustomValidity('');});
  });
  function validateReferral(id) {
    const field = byId(id);
    let message = '';
    try { model.referralLine(field.value, ownCode, SaraiI18n.language); }
    catch (error) {message = t(error.message === 'self' ? 'Шақыруға өз кодыңызды енгізбеңіз.' : 'Кодты тексеріңіз. Үлгі: SARAI-ABCDEFGH.');}
    field.setCustomValidity(message);
    return !message;
  }
  window.SaraiReferral = Object.freeze({
    validate: validateReferral,
    line(id) { return model.referralLine(byId(id).value, ownCode, SaraiI18n.language); }
  });
  function clearSelfReferral() {
    referralFields.forEach(id => {
      const field = byId(id);
      if (model.normalizeCode(field.value) === ownCode) {field.value = ''; field.dispatchEvent(new Event('input', {bubbles: true}));}
    });
    if (incomingCode === ownCode) {incomingCode = null; model.setStored(session, model.receivedCodeKey, null);}
  }
  function renderInvite() {
    byId('personalInvitePanel').hidden = !ownCode;
    byId('createInviteCode').hidden = Boolean(ownCode);
    if (!ownCode) return;
    byId('personalInviteCode').value = ownCode;
    const version = document.querySelector('meta[name="sarai-version"]')?.content;
    const url = model.inviteUrl(ownCode, SaraiI18n.language, version);
    byId('personalInviteUrl').value = url;
    const registration = [t('SARAI — шақыру кодын тіркеу'), t('Менің кодым:') + ' ' + ownCode, t('Осы кодты менімен байланыстырып, расталған шақыруларды есепке алуыңызды сұраймын.')].join('\n');
    byId('registerInviteCode').href = 'https://wa.me/77027935200?text=' + encodeURIComponent(registration);
    const invitation = t('SARAI: Астанада шебер табыңыз, өтінім қалдырыңыз немесе тегін PDF смета жасаңыз.') + '\n' + url;
    byId('shareInviteWhatsApp').href = 'https://wa.me/?text=' + encodeURIComponent(invitation);
  }
  function rememberCode(code) {
    ownCode = code;
    const saved = model.setStored(local, model.ownCodeKey, code);
    byId('inviteStorageStatus').textContent = t(saved ? 'Код осы браузерде сақталды. Енді оны SARAI-ға тіркетіңіз.' : 'Браузер кодты сақтай алмады. Кодты көшіріп алып, SARAI-ға жіберіңіз.');
    clearSelfReferral(); renderInvite();
  }
  byId('createInviteCode').addEventListener('click', () => {
    try {rememberCode(model.generateCode(crypto.getRandomValues(new Uint8Array(8))));}
    catch (error) {byId('inviteStorageStatus').textContent = t('Код жасау мүмкін болмады. Бетті жаңартып көріңіз немесе SARAI-ға жазыңыз.');}
  });
  byId('copyInviteUrl').addEventListener('click', () => copyText(byId('personalInviteUrl'), 'personalInviteStatus'));
  byId('restoreInviteCode').addEventListener('input', event => {event.target.value = event.target.value.toUpperCase(); byId('restoreInviteStatus').textContent = '';});
  byId('restoreInviteButton').addEventListener('click', () => {
    const code = model.normalizeCode(byId('restoreInviteCode').value);
    if (!code) {byId('restoreInviteStatus').textContent = t('Кодты тексеріңіз. Үлгі: SARAI-ABCDEFGH.'); return;}
    rememberCode(code); byId('restoreInviteStatus').textContent = t('Код қолданылды. Оның сізге тиесілі екенін SARAI растайды.');
    byId('personalInviteCode').focus({preventScroll: true});
  });

  const todayParts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Almaty', year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(new Date()).map(part => [part.type, part.value]));
  const today = todayParts.year + '-' + todayParts.month + '-' + todayParts.day;
  byId('estimateDate').value = today; byId('estimateDate').defaultValue = today;
  const blankItem = () => ({name: '', quantity: '1', unit: 'm2', price: ''});
  let items = [blankItem()];
  const rowNodes = [];
  const moneyCents = value => new Intl.NumberFormat('ru-KZ', {maximumFractionDigits: 2}).format(value / 100) + ' ₸';
  function make(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }
  function inputField(labelText, name, value, rowIndex) {
    const wrap = make('div', 'estimate-field estimate-field-' + name);
    const id = 'estimate-' + rowIndex + '-' + name;
    const label = make('label', '', t(labelText)); label.htmlFor = id;
    const input = make(name === 'unit' ? 'select' : 'input'); input.id = id; input.name = id;
    if (name === 'unit') {
      Object.entries(model.units).forEach(([key, label]) => {const option = make('option', '', t(label)); option.value = key; input.append(option);});
    } else {
      input.type = 'text'; input.required = true; input.autocomplete = 'off';
      if (name === 'name') {input.maxLength = model.limits.name; input.placeholder = t('Мысалы: қабырғаны бояу');}
      else {input.inputMode = 'decimal'; input.maxLength = 18;}
    }
    input.value = value; input.defaultValue = value;
    if (name === 'unit') Array.from(input.options).forEach(option => {option.defaultSelected = option.value === value;});
    const eventName = name === 'unit' ? 'change' : 'input';
    input.addEventListener(eventName, () => {
      items[rowIndex][name] = input.value;
      input.setCustomValidity(''); byId('estimateToolStatus').textContent = ''; updateTotals();
    });
    wrap.append(label, input); return {wrap, input};
  }
  function renderRows(focusIndex) {
    invalidatePdf();
    rowNodes.length = 0;
    const cards = items.map((item, index) => {
      const card = make('article', 'card estimate-item');
      const heading = make('div', 'estimate-item-heading');
      heading.append(make('h3', '', t('Жұмыс {number}', {number: index + 1})));
      const remove = make('button', 'estimate-remove', t('Жою')); remove.type = 'button';
      remove.setAttribute('aria-label', t('{number}-жолды алып тастау', {number: index + 1}));
      remove.addEventListener('click', () => {
        items.splice(index, 1); if (!items.length) items.push(blankItem()); renderRows(Math.min(index, items.length - 1));
      });
      heading.append(remove); card.append(heading);
      const fields = make('div', 'estimate-item-fields');
      const nodes = {};
      [['name', 'Жұмыс немесе материал атауы'], ['quantity', 'Көлемі'], ['unit', 'Өлшем бірлігі'], ['price', 'Бірлік бағасы, ₸']].forEach(([name, label]) => {
        const field = inputField(label, name, item[name], index); fields.append(field.wrap); nodes[name] = field.input;
      });
      const amount = make('div', 'estimate-line-amount'); amount.append(make('span', '', t('Жол сомасы')));
      nodes.amount = make('strong'); amount.append(nodes.amount); card.append(fields, amount); rowNodes.push(nodes); return card;
    });
    byId('estimateItems').replaceChildren(...cards);
    byId('addEstimateRow').disabled = items.length >= model.limits.rows;
    byId('estimateRowCount').textContent = items.length + ' / ' + model.limits.rows;
    updateTotals();
    if (focusIndex !== undefined) rowNodes[focusIndex].name.focus();
  }
  function updateTotals() {
    let total = 0, complete = true;
    items.forEach((item, index) => {
      try {const result = model.line(item); rowNodes[index].amount.textContent = moneyCents(result.amountCents); total += result.amountCents;}
      catch (error) {rowNodes[index].amount.textContent = '—'; complete = false;}
    });
    byId('estimateGrandTotal').textContent = complete && total <= model.limits.totalCents ? moneyCents(total) : '—';
  }
  function rawEstimate() {
    return {title: byId('estimateProject').value.trim() || t('Жөндеу жұмыстары'), author: byId('estimateAuthor').value, notes: byId('estimateNotes').value, date: byId('estimateDate').value, items: items.map(item => ({...item}))};
  }
  window.SaraiLeanHasDraft = () => items.length !== 1 || items[0].name !== '' || items[0].quantity !== '1' || items[0].unit !== 'm2' || items[0].price !== '' || Boolean(byId('estimateProject').value || byId('estimateAuthor').value || byId('estimateNotes').value) || byId('estimateDate').value !== today;
  function validateEstimate() {
    rowNodes.forEach((nodes, index) => {
      const item = items[index]; nodes.name.setCustomValidity(item.name.trim() ? '' : t('Жұмыс атауын енгізіңіз.'));
      try {model.scaled(item.quantity, 3, 100000, false); nodes.quantity.setCustomValidity('');}
      catch (error) {nodes.quantity.setCustomValidity(t('Көлемді 0,001–100 000 аралығында, ең көбі үш ондық таңбамен енгізіңіз.'));}
      try {model.scaled(item.price, 2, 100000000, true); nodes.price.setCustomValidity('');}
      catch (error) {nodes.price.setCustomValidity(t('Бағаны 0–100 000 000 аралығында, ең көбі екі ондық таңбамен енгізіңіз.'));}
    });
    if (!byId('estimateToolForm').reportValidity()) return null;
    const input = rawEstimate();
    try {model.estimate(input); return input;}
    catch (error) {byId('estimateToolStatus').textContent = t('Есеп мәліметтерін тексеріңіз: жолдар мен жалпы сома рұқсат етілген шектен аспауы керек.'); return null;}
  }
  byId('addEstimateRow').addEventListener('click', () => {if (items.length < model.limits.rows) {items.push(blankItem()); renderRows(items.length - 1);}});
  let logo = null, logoPromise = null;
  let preparedPdfURL = null;
  function invalidatePdf() {
    if (preparedPdfURL) URL.revokeObjectURL(preparedPdfURL);
    preparedPdfURL = null;
    byId('preparedPdfPanel').hidden = true;
    byId('saveEstimatePdf').removeAttribute('href');
  }
  ['input', 'change'].forEach(type => byId('estimateToolForm').addEventListener(type, () => {invalidatePdf(); byId('estimateToolStatus').textContent = '';}));
  function loadLogo() {
    if (!logoPromise) {
      const image = document.querySelector('header .brand-logo image');
      const source = image?.getAttribute('href') || './sarai-logo.png';
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      logoPromise = fetch(source, {signal: controller.signal}).then(response => {if (!response.ok) throw new Error('logo'); return response.arrayBuffer();}).then(buffer => {logo = new Uint8Array(buffer); return logo;}).catch(() => null).finally(() => clearTimeout(timeout));
    }
    return logoPromise;
  }
  let pdfBusy = false;
  function makePdf(input) {return SaraiEstimatePdf.create(input, SaraiI18n.language, {jsPDF: jspdf.jsPDF, fonts: SaraiPdfFonts, logo});}
  function busyPdf(value) {
    pdfBusy = value; byId('downloadEstimatePdf').disabled = value; byId('shareEstimatePdf').disabled = value;
    byId('estimateToolForm').setAttribute('aria-busy', String(value));
  }
  byId('estimateToolForm').addEventListener('submit', async event => {
    event.preventDefault(); if (pdfBusy) return;
    const input = validateEstimate(); if (!input) return;
    busyPdf(true); byId('estimateToolStatus').textContent = t('PDF дайындалып жатыр…');
    try {
      await loadLogo(); const result = makePdf(input);
      invalidatePdf(); preparedPdfURL = URL.createObjectURL(result.doc.output('blob'));
      const link = byId('saveEstimatePdf'); link.href = preparedPdfURL; link.download = result.filename;
      byId('preparedPdfPanel').hidden = false;
      byId('estimateToolStatus').textContent = t('PDF дайын. Оны жүктеу батырмасымен сақтаңыз.');
      link.focus({preventScroll: true}); link.scrollIntoView({block: 'nearest'});
    } catch (error) {byId('estimateToolStatus').textContent = t('PDF жасау мүмкін болмады. Мәліметтерді тексеріп, қайта көріңіз.');}
    finally {busyPdf(false);}
  });
  try {byId('shareEstimatePdf').hidden = !(navigator.canShare && navigator.canShare({files: [new File(['PDF'], 'SARAI.pdf', {type: 'application/pdf'})]}));} catch (error) {byId('shareEstimatePdf').hidden = true;}
  byId('shareEstimatePdf').addEventListener('click', async () => {
    if (pdfBusy) return; const input = validateEstimate(); if (!input) return;
    busyPdf(true); byId('estimateToolStatus').textContent = '';
    try {
      const result = makePdf(input);
      const file = new File([result.doc.output('arraybuffer')], result.filename, {type: 'application/pdf'});
      await navigator.share({files: [file], title: input.title});
    } catch (error) {if (error?.name !== 'AbortError') byId('estimateToolStatus').textContent = t('Бөлісу мүмкін болмады. PDF файлын жүктеп, қолмен жіберіңіз.');}
    finally {busyPdf(false);}
  });
  byId('openEstimateTool').addEventListener('click', () => {
    const pristine = items.length === 1 && !items[0].name && !items[0].price && !byId('estimateAuthor').value && !byId('estimateNotes').value && !byId('estimateProject').value;
    const calculation = readEstimate();
    if (pristine && calculation) {
      items = [{name: t('Үлгілік жөндеу есебі:') + ' ' + t(calculation.label), quantity: String(calculation.area), unit: 'm2', price: String(calculation.rate)}];
      renderRows();
    }
  });
  let currentTool = null;
  function route() {
    const target = window.location.hash.slice(1);
    const active = ['estimate-tool', 'invite-tool'].includes(target) ? target : null;
    const changed = active !== currentTool;
    document.body.classList.toggle('sarai-utility-open', Boolean(active));
    document.documentElement.classList.toggle('sarai-utility-open', Boolean(active));
    byId('estimate-tool').hidden = active !== 'estimate-tool'; byId('invite-tool').hidden = active !== 'invite-tool';
    if (active) {
      document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
      document.title = t(active === 'estimate-tool' ? 'Жұмыс сметасы' : 'Досыңды шақыр') + ' · SARAI';
      if (changed) {window.scrollTo(0, 0); byId(active === 'estimate-tool' ? 'estimateToolTitle' : 'inviteToolTitle').focus({preventScroll: true});}
      if (active === 'estimate-tool') loadLogo();
    } else if (currentTool) {
      document.title = t('SARAI — Үйіңіздің жаңа жолы');
      requestAnimationFrame(() => {const anchor = document.getElementById(target); if (anchor) anchor.scrollIntoView({block: 'start'});});
    }
    currentTool = active;
  }
  window.addEventListener('hashchange', route);
  document.addEventListener('sarai:languagechange', () => {renderInvite(); renderRows(); byId('estimateToolStatus').textContent = ''; byId('personalInviteStatus').textContent = ''; route();});
  renderInvite(); renderRows(); route();
}());
