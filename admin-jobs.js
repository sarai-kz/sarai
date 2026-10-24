(function () {
  'use strict';
  const model = SaraiJobs;
  const $ = id => document.getElementById(id);
  let records = [], editing = null, loaded = false, loading = false, pending = null, timer = null, attempts = 0, version = 0;
  const make = (tag, className, text) => {const node = document.createElement(tag); node.className = className; node.textContent = text; return node;};
  const option = (select, value, label) => {const node = make('option', '', label); node.value = value; $(select).append(node);};
  model.services.forEach(value => option('editJobService', value, value));
  model.starts.forEach(value => option('editJobStart', value, value));
  Object.entries(model.statuses).forEach(([value, label]) => {option('editJobStatus', value, label); option('adminJobStatus', value, label);});
  function reset() {
    editing = null; version++;
    $('jobEditor').reset(); $('jobEditorTitle').textContent = 'Тапсырыс қосу';
    $('cancelJobEdit').hidden = true; $('jobEditorError').hidden = true; $('jobConfirmation').hidden = true;
  }
  function edit(record) {
    editing = record; version++;
    const values = {editJobService: record.service, editJobTitle: record.title, editJobDescription: record.description, editJobDistrict: record.district, editJobArea: record.area ?? '', editJobBudget: record.budget ?? '', editJobStart: record.start, editJobStatus: record.status};
    Object.entries(values).forEach(([id,value]) => {$(id).value = value;});
    $('publicJobConfirmed').checked = false;
    $('jobEditorTitle').textContent = 'Өзгерту: ' + record.id;
    $('cancelJobEdit').hidden = false; $('jobEditorError').hidden = true; $('jobConfirmation').hidden = true;
    $('editJobTitle').focus(); $('jobEditorTitle').scrollIntoView({block:'start', behavior:'smooth'});
  }
  function render() {
    Object.entries({open:'openTotal',in_progress:'progressTotal',closed:'closedTotal'}).forEach(([status,id]) => {$(id).textContent = records.filter(record => record.status === status).length;});
    const query = SaraiMasters.search($('adminJobSearch').value).split(' ').filter(Boolean);
    const status = $('adminJobStatus').value;
    const found = records.filter(record => (status === 'all' || record.status === status) && query.every(word => SaraiMasters.search([record.id,record.title,record.description,record.service,record.district].join(' ')).includes(word))).sort((a,b) => Date.parse(b.published_at)-Date.parse(a.published_at));
    $('adminJobsList').replaceChildren(...found.map(record => {
      const article = make('article', 'master-row', '');
      article.append(make('span','pill',model.statuses[record.status]),make('h3','',record.title),make('p','muted',record.id + ' · ' + record.service),make('p','desc',record.description));
      const facts = [record.district, record.area === null ? '' : record.area + ' м²', record.budget === null ? 'Бюджет: келісімді' : record.budget.toLocaleString('kk-KZ') + ' ₸'].filter(Boolean).join(' · ');
      article.append(make('p','',facts));
      const actions = make('div','actions','');
      const change = make('button','btn alt small','Өзгерту'); change.type='button'; change.addEventListener('click',()=>edit(record)); actions.append(change);
      const next = record.status === 'open' ? 'in_progress' : record.status === 'in_progress' ? 'closed' : 'open';
      const nextButton = make('button','btn small', next === 'in_progress' ? 'Жұмыс басталды' : next === 'closed' ? 'Аяқталды' : 'Қайта ашу'); nextButton.type='button';
      nextButton.addEventListener('click',()=>{edit(record); $('editJobStatus').value=next; $('jobPublishStatus').textContent='Мәртебені тексеріп, төмендегі растау белгісін қойып жариялауға дайындаңыз.';}); actions.append(nextButton);
      const link=make('a','btn alt small','Сайтта көру');link.href='./?lang=kk#job-'+record.id;link.target='_blank';link.rel='noopener noreferrer';actions.append(link);article.append(actions);return article;
    }));
    $('adminJobsEmpty').hidden = !loaded || found.length > 0;
  }
  async function load(quiet=false) {
    if(loading) return; loading=true;
    if(!quiet){$('adminJobsLoading').hidden=false;$('adminJobsError').hidden=true;}
    $('reloadJobs').disabled=true;$('adminJobsList').setAttribute('aria-busy','true');
    const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),10000);
    try{
      const response=await fetch('./data/jobs.json?t='+Date.now(),{cache:'no-store',signal:controller.signal});
      if(!response.ok)throw new Error('List unavailable');
      records=model.feed(await response.json()).jobs;loaded=true;$('publishJob').disabled=false;$('adminJobsError').hidden=true;render();
      if(pending){
        const record=records.find(item=>item.id===pending.record.id);
        if(record && model.revision(record)!==pending.base && JSON.stringify(model.core(record))===JSON.stringify(pending.record)){
          $('jobPublishStatus').textContent='Сақталды! Тапсырыс пен мәртебесі сайтта жаңарды.';
          const unchanged=version===pending.formVersion;pending=null;clearInterval(timer);if(unchanged)reset();
        }
      }
    }catch(error){$('adminJobsError').hidden=false;}
    finally{loading=false;clearTimeout(timeout);$('adminJobsLoading').hidden=true;$('reloadJobs').disabled=false;$('adminJobsList').setAttribute('aria-busy','false');}
  }
  function prepare(record,base){
    const payload=model.request(record,base);const url=model.issueUrl(payload);
    $('jobConfirmLink').href=url;$('jobConfirmation').hidden=false;$('jobEditorError').hidden=true;
    $('jobPublishStatus').textContent='Әзірге сақталған жоқ. Ашылған GitHub бетінде «Create» басыңыз.';
    pending={record:model.core(record),base,formVersion:version};attempts=0;clearInterval(timer);
    timer=setInterval(()=>{load(true);if(++attempts>=20){clearInterval(timer);if(pending)$('jobPublishStatus').textContent='Әзірге жаңармады. GitHub-та «Create» басылғанын және жариялану барысын тексеріңіз.';}},15000);
    window.open(url,'_blank','noopener,noreferrer');
  }
  $('jobEditor').addEventListener('submit',event=>{
    event.preventDefault();if(!loaded || !$('jobEditor').reportValidity())return;
    try{
      const id=editing ? editing.id : 'SARAI-'+new Date().toISOString().slice(0,10).replace(/-/g,'')+'-'+(typeof crypto.randomUUID === 'function' ? crypto.randomUUID().slice(0,8) : Array.from(crypto.getRandomValues(new Uint8Array(6)),n=>n.toString(16).padStart(2,'0')).join('')).toUpperCase();
      const record={id,status:$('editJobStatus').value,city:'Астана',service:$('editJobService').value,title:$('editJobTitle').value,description:$('editJobDescription').value,district:$('editJobDistrict').value,area:$('editJobArea').value===''?null:Number($('editJobArea').value),budget:$('editJobBudget').value===''?null:Number($('editJobBudget').value),start:$('editJobStart').value,published_at:editing?editing.published_at:new Date().toISOString()};
      prepare(record,model.revision(editing));
    }catch(error){$('jobEditorError').textContent=error.message;$('jobEditorError').hidden=false;}
  });
  $('editJobService').addEventListener('change',()=>{if(!$('editJobTitle').value.trim())$('editJobTitle').value=$('editJobService').value;});
  $('jobEditor').addEventListener('input',()=>{version++;$('jobEditorError').hidden=true;$('jobConfirmation').hidden=true;});
  $('cancelJobEdit').addEventListener('click',reset);$('reloadJobs').addEventListener('click',()=>load());
  $('adminJobSearch').addEventListener('input',render);$('adminJobStatus').addEventListener('change',render);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)load(true);});
  function commission(){
    const a=$('commissionAmount'),p=$('commissionPercent');
    if(a.value===''||p.value===''||!a.validity.valid||!p.validity.valid){$('commissionOutput').textContent='Есеп үшін екі өрісті толтырыңыз.';return;}
    const amount=Number(a.value),fee=Math.round(amount*Number(p.value)/100);
    $('commissionOutput').textContent='SARAI комиссиясы: '+fee.toLocaleString('kk-KZ')+' ₸ · Шеберге: '+(amount-fee).toLocaleString('kk-KZ')+' ₸';
  }
  ['commissionAmount','commissionPercent'].forEach(id=>$(id).addEventListener('input',commission));load();
}());
