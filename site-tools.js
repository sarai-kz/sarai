(function () {
  'use strict';
  const t = SaraiI18n.text;
  const select = document.getElementById('specialty');
  Object.values(SaraiMasters.trades).forEach(trade => {
    const option = document.createElement('option'); option.value = trade.label; option.textContent = t(trade.label); select.append(option);
  });
  const notice = document.getElementById('connectionNotice');
  function connection() {notice.hidden = navigator.onLine;}
  window.addEventListener('online',connection);window.addEventListener('offline',connection);connection();
  const back = document.getElementById('backToTop');
  function scroll() {back.hidden = window.scrollY < 900;}
  window.addEventListener('scroll',scroll,{passive:true});scroll();
  document.addEventListener('sarai:languagechange',()=>{
    Array.from(select.options).forEach(option=>{if(option.value)option.textContent=t(option.value);});
  });
}());
