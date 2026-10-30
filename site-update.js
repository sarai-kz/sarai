(function () {
  'use strict';
  const byId = id => document.getElementById(id);
  const button = byId('refreshSite');
  const message = byId('siteUpdateMessage');
  const container = byId('siteUpdater');
  const dialog = byId('siteRefreshConfirm');
  const current = document.querySelector('meta[name="sarai-version"]')?.content;
  const isVersion = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
  const phrases = {
    refresh: ['Жаңарту', 'Обновить'],
    checking: ['Тексерілуде…', 'Проверяем…'],
    available: ['Сайттың жаңа нұсқасы бар. Жаңарту үшін батырманы басыңыз.', 'Доступна новая версия сайта. Нажмите «Обновить».'],
    offline: ['Интернет жоқ. Байланыс қосылғанда қайта көріңіз.', 'Нет интернета. Попробуйте после подключения.'],
    error: ['Жаңарту мүмкін болмады. Қайта көріңіз.', 'Не удалось обновить сайт. Попробуйте ещё раз.'],
    title: ['Сайтты жаңарту керек пе?', 'Обновить сайт?'],
    warning: ['Толтырылған форма жаңартқанда тазаланады. Алдымен өтінімді жіберіңіз немесе жаңартуды жалғастырыңыз.', 'При обновлении заполненная форма очистится. Сначала отправьте заявку или продолжите обновление.'],
    cancel: ['Формаға оралу', 'Вернуться к форме']
  };
  let latest = null;
  let state = '';
  let busy = false;
  let pending = null;
  let lastCheck = 0;
  const text = key => phrases[key][SaraiI18n.language === 'ru' ? 1 : 0];

  function render() {
    byId('siteRefreshLabel').textContent = text(busy ? 'checking' : 'refresh');
    button.disabled = busy;
    container.toggleAttribute('data-available', Boolean(latest && latest !== current));
    message.hidden = !state;
    message.textContent = state ? text(state) : '';
    byId('siteRefreshTitle').textContent = text('title');
    byId('siteRefreshWarning').textContent = text('warning');
    byId('cancelSiteRefresh').textContent = text('cancel');
    byId('confirmSiteRefresh').textContent = text('refresh');
  }

  function hasDraft() {
    if (typeof window.SaraiLeanHasDraft === 'function' && window.SaraiLeanHasDraft()) return true;
    return Array.from(document.querySelectorAll('form input, form textarea, form select')).some(field => {
      if (field.disabled || ['hidden', 'submit', 'button'].includes(field.type)) return false;
      if (['checkbox', 'radio'].includes(field.type)) return field.checked !== field.defaultChecked;
      if (field.tagName === 'SELECT') {
        const initial = Array.from(field.options).find(option => option.defaultSelected) || field.options[0];
        return field.value !== (initial?.value || '');
      }
      return field.value !== field.defaultValue;
    });
  }

  function navigate() {
    const url = new URL(window.location.href);
    url.searchParams.set('lang', SaraiI18n.language);
    url.searchParams.set('_sarai_update', latest + '.' + Date.now());
    window.location.replace(url.href);
  }

  async function loadVersion() {
    if (navigator.onLine === false) throw new Error('offline');
    if (pending) return pending;
    pending = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const url = new URL('./site-version.json', window.location.href);
        url.searchParams.set('_check', String(Date.now()));
        const response = await fetch(url.href, {cache: 'no-store', credentials: 'same-origin', signal: controller.signal});
        if (!response.ok) throw new Error('version');
        const data = await response.json();
        if (!isVersion(data.version)) throw new Error('version');
        latest = data.version;
        state = latest !== current ? 'available' : '';
        return latest;
      } finally {
        clearTimeout(timeout);
      }
    })();
    try { return await pending; } finally { pending = null; }
  }

  async function check() {
    if (document.hidden || navigator.onLine === false || busy || Date.now() - lastCheck < 5000) return;
    lastCheck = Date.now();
    try { await loadVersion(); } catch (error) { /* Keep the page and any known update available. */ }
    render();
  }

  button.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    render();
    try {
      await loadVersion();
      if (hasDraft()) {
        dialog.showModal();
        byId('cancelSiteRefresh').focus();
      } else navigate();
    } catch (error) {
      state = navigator.onLine === false ? 'offline' : 'error';
    } finally {
      busy = false;
      render();
    }
  });
  byId('cancelSiteRefresh').addEventListener('click', () => { dialog.close(); button.focus(); });
  byId('confirmSiteRefresh').addEventListener('click', () => {
    if (navigator.onLine === false) { state = 'offline'; dialog.close(); render(); return; }
    navigate();
  });
  document.addEventListener('sarai:languagechange', render);
  document.addEventListener('visibilitychange', check);
  window.addEventListener('online', check);
  window.addEventListener('focus', check);
  window.addEventListener('pageshow', check);
  setInterval(check, 60000);
  render();
  check();
}());
