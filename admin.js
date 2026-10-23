(function () {
  'use strict';
  const model = SaraiMasters;
  const $ = id => document.getElementById(id);
  let records = [];
  let editing = null;
  let loaded = false;
  let pending = null;
  let pendingBase = null;
  let pollTimer = null;
  let pollCount = 0;
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    node.className = className;
    node.textContent = text;
    return node;
  };
  Object.entries(model.trades).forEach(([key, trade]) => {
    const option = make('option', '', trade.label);
    option.value = key;
    $('editorTrade').append(option);
  });
  function core(record) {
    return {id: record.id, name: record.name, city: record.city, trade: record.trade, phone: record.phone, description: record.description, active: record.active};
  }
  function resetEditor() {
    editing = null;
    $('masterEditor').reset();
    $('editorTitle').textContent = 'Шебер қосу';
    $('publishMaster').textContent = 'GitHub-та жариялау';
    $('cancelMasterEdit').hidden = true;
    $('editorError').hidden = true;
    $('masterConfirmation').hidden = true;
  }
  function edit(record) {
    editing = record;
    $('editorName').value = record.name;
    $('editorTrade').value = record.trade;
    $('editorPhone').value = model.formatPhone(record.phone);
    $('editorDescription').value = record.description;
    $('editorActive').checked = record.active;
    $('editorTitle').textContent = 'Шебер мәліметін өзгерту';
    $('publishMaster').textContent = 'Өзгерісті GitHub-та сақтау';
    $('cancelMasterEdit').hidden = false;
    $('editorError').hidden = true;
    $('masterConfirmation').hidden = true;
    $('editorName').focus();
    $('editorTitle').scrollIntoView({behavior: 'smooth', block: 'start'});
  }
  function render() {
    const query = model.search($('adminMasterSearch').value).split(' ').filter(Boolean);
    const visibleRecords = records.filter(record => {
      const haystack = model.search(record.name + ' ' + record.phone + ' ' + model.trades[record.trade].label);
      return query.every(word => haystack.includes(word));
    });
    $('adminMasterList').replaceChildren(...visibleRecords.map(record => {
      const row = make('article', 'master-row', '');
      row.dataset.masterId = record.id;
      row.append(make('span', record.active ? 'pill' : 'pill hidden', record.active ? 'Сайтта көрсетілген' : 'Жасырылған'), make('h3', '', record.name), make('p', '', model.trades[record.trade].label), make('p', 'phone', model.formatPhone(record.phone)));
      if (record.description) row.append(make('p', 'desc', record.description));
      const actions = make('div', 'actions', '');
      const editButton = make('button', 'btn alt small', 'Өзгерту');
      editButton.type = 'button';
      editButton.addEventListener('click', () => edit(record));
      const visibilityButton = make('button', 'btn alt small', record.active ? 'Жасыру' : 'Қайта көрсету');
      visibilityButton.type = 'button';
      visibilityButton.addEventListener('click', () => prepare({...core(record), active: !record.active}, record.updated_at));
      actions.append(editButton, visibilityButton);
      row.append(actions);
      return row;
    }));
    const active = records.filter(record => record.active).length;
    $('activeMasterTotal').textContent = active + ' шебер сайтта';
    $('hiddenMasterTotal').textContent = (records.length - active) + ' жасырылған';
    $('hiddenMasterTotal').hidden = records.length === active;
    $('adminEmpty').hidden = !loaded || visibleRecords.length > 0;
  }
  function matchesPending(record) {
    return record && record.updated_at !== pendingBase && Object.keys(pending).every(key => record[key] === pending[key]);
  }
  async function load(quiet = false) {
    if (!quiet) {
      $('adminLoading').hidden = false;
      $('adminLoadError').hidden = true;
      $('reloadMasterList').disabled = true;
      $('adminMasterList').setAttribute('aria-busy', 'true');
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch('./masters.json?t=' + Date.now(), {cache: 'no-store', signal: controller.signal});
      if (!response.ok) throw new Error('List unavailable');
      records = model.feed(await response.json()).masters;
      loaded = true;
      $('publishMaster').disabled = false;
      $('adminLoadError').hidden = true;
      render();
      if (pending && matchesPending(records.find(record => record.id === pending.id))) {
        $('publishStatus').textContent = pending.active ? 'Жарияланды! Шебердің мәліметі клиенттік сайтта көрінеді.' : 'Шебер клиенттер тізімінен жасырылды.';
        pending = null;
        clearInterval(pollTimer);
        resetEditor();
      }
    } catch (error) {
      if (!quiet) $('adminLoadError').hidden = false;
    } finally {
      clearTimeout(timeout);
      $('adminLoading').hidden = true;
      $('reloadMasterList').disabled = false;
      $('adminMasterList').setAttribute('aria-busy', 'false');
    }
  }
  function prepare(record, expectedUpdatedAt) {
    try {
      const request = model.request(record, expectedUpdatedAt);
      const url = model.issueUrl(request);
      $('confirmMasterLink').href = url;
      $('masterConfirmation').hidden = false;
      $('editorError').hidden = true;
      $('confirmationText').textContent = record.active ? 'GitHub-та «Create» батырмасын басып жариялауды раста. Содан кейін осы бетке орал.' : 'GitHub-та «Create» батырмасын басып жасыруды раста. Содан кейін осы бетке орал.';
      $('publishStatus').textContent = 'Әзірге сайтқа сақталған жоқ. GitHub-та «Create» батырмасымен растау қажет.';
      pending = core(request.master);
      pendingBase = expectedUpdatedAt;
      pollCount = 0;
      clearInterval(pollTimer);
      pollTimer = setInterval(() => {
        pollCount++;
        load(true);
        if (pollCount >= 16) {
          clearInterval(pollTimer);
          if (pending) $('publishStatus').textContent = 'Жаңарту әлі тізімге түспеді. GitHub-та «Create» басылғанын тексеріп, «Тізімді жаңарту» батырмасын бас. Қате болса, «Жариялану барысы» сілтемесінен көре аласың.';
        }
      }, 15000);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      $('editorError').textContent = error.message;
      $('editorError').hidden = false;
    }
  }
  $('masterEditor').addEventListener('submit', event => {
    event.preventDefault();
    if (!loaded || !$('masterEditor').reportValidity()) return;
    const id = editing ? editing.id : 'm-' + (typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10));
    prepare({id, name: $('editorName').value, city: 'Астана', trade: $('editorTrade').value, phone: $('editorPhone').value, description: $('editorDescription').value, active: $('editorActive').checked}, editing ? editing.updated_at : null);
  });
  $('masterEditor').addEventListener('input', () => {
    $('editorError').hidden = true;
    $('masterConfirmation').hidden = true;
  });
  $('cancelMasterEdit').addEventListener('click', resetEditor);
  $('reloadMasterList').addEventListener('click', () => load());
  $('adminMasterSearch').addEventListener('input', render);
  document.addEventListener('visibilitychange', () => {if (!document.hidden && pending) load(true);});
  load();
}());
