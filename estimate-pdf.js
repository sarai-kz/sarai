/* SARAI PDF renderer. User text is rendered as text, never as HTML. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./lean-model.js'));
  else root.SaraiEstimatePdf = factory(root.SaraiLean);
}(typeof globalThis === 'undefined' ? this : globalThis, function (model) {
  'use strict';
  function create(input, language, options) {
    const data = model.estimate(input);
    const ru = language === 'ru';
    const labels = ru ? {
      title: 'СМЕТА', preliminary: 'Предварительный расчет', date: 'Дата', author: 'Исполнитель',
      work: 'Работа / материал', quantity: 'Объем', unit: 'Ед.', price: 'Цена, ₸', amount: 'Сумма, ₸',
      total: 'ИТОГО', notes: 'Примечание', continued: 'Продолжение',
      disclaimer: 'Учтены только строки, включенные в эту смету. Итоговая стоимость, состав работ и материалов согласовываются с заказчиком.',
      footer: 'Создано в SARAI', page: 'Страница', units: {m2: 'м²', metre: 'м.п.', piece: 'шт.', set: 'компл.', hour: 'ч.'}
    } : {
      title: 'СМЕТА', preliminary: 'Алдын ала есеп', date: 'Күні', author: 'Орындаушы',
      work: 'Жұмыс / материал', quantity: 'Көлемі', unit: 'Өлш.', price: 'Бағасы, ₸', amount: 'Сомасы, ₸',
      total: 'ЖАЛПЫ', notes: 'Ескерту', continued: 'Жалғасы',
      disclaimer: 'Осы сметаға енгізілген жолдар ғана есепке алынды. Соңғы баға, жұмыстар мен материалдар құрамы клиентпен келісіледі.',
      footer: 'SARAI арқылы жасалған', page: 'Бет', units: model.units
    };
    const doc = new options.jsPDF({unit: 'mm', format: 'a4', compress: true, putOnlyUsedFonts: true});
    doc.addFileToVFS('SARAI-Regular.ttf', options.fonts.regular);
    doc.addFileToVFS('SARAI-Bold.ttf', options.fonts.bold);
    doc.addFont('SARAI-Regular.ttf', 'SARAI', 'normal');
    doc.addFont('SARAI-Bold.ttf', 'SARAI', 'bold');
    const ink = [16, 43, 57], teal = [8, 127, 118], muted = [91, 113, 123];
    const money = cents => new Intl.NumberFormat('ru-KZ', {minimumFractionDigits: 0, maximumFractionDigits: 2}).format(cents / 100);
    const number = value => new Intl.NumberFormat('ru-KZ', {maximumFractionDigits: 3}).format(value);
    const dateText = new Intl.DateTimeFormat(ru ? 'ru-KZ' : 'kk-KZ', {day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Almaty'}).format(new Date(data.date + 'T12:00:00Z'));
    let y = 0;
    const font = (size, bold, color) => {doc.setFont('SARAI', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(...(color || ink));};
    function logo() {
      if (options.logo) {
        // The same viewBox as the site's approved logo, using PDF clipping only.
        doc.saveGraphicsState(); doc.rect(16, 10, 49, 24); doc.clip(); doc.discardPath();
        const scale = 49 / 1340;
        doc.addImage(options.logo, 'PNG', 16 - 150 * scale, 10 - 160 * scale, 1635 * scale, 962 * scale, 'sarai-logo', 'FAST');
        doc.restoreGraphicsState();
      } else {font(24, true); doc.text('SARAI', 16, 25);}
    }
    function header(first) {
      logo(); font(19, true); doc.text(labels.title, 194, 20, {align: 'right'});
      font(8.5, false, muted); doc.text(labels.preliminary, 194, 27, {align: 'right'});
      doc.text(labels.date + ': ' + dateText, 194, 34, {align: 'right'});
      doc.setDrawColor(217, 229, 232); doc.setLineWidth(0.35); doc.line(16, 41, 194, 41);
      if (first) {
        font(14, true); const titleLines = doc.splitTextToSize(data.title, 178); doc.text(titleLines, 16, 52); y = 52 + titleLines.length * 6;
        if (data.author) {font(9, false, muted); const lines = doc.splitTextToSize(labels.author + ': ' + data.author, 178); doc.text(lines, 16, y + 2); y += lines.length * 4.5 + 5;}
        y += 5;
      } else {
        font(8.5, false, muted); doc.text(labels.continued, 16, 49); y = 55;
      }
    }
    function tableHead() {
      doc.setFillColor(...teal); doc.rect(16, y, 178, 11, 'F'); font(8, true, [255, 255, 255]);
      doc.text('№', 20, y + 7); doc.text(labels.work, 28, y + 7);
      doc.text(labels.quantity, 122, y + 7, {align: 'right'}); doc.text(labels.unit, 133, y + 7, {align: 'center'});
      doc.text(labels.price, 163, y + 7, {align: 'right'}); doc.text(labels.amount, 191, y + 7, {align: 'right'}); y += 11;
    }
    function nextPage(withTable) {doc.addPage(); header(false); if (withTable) tableHead();}
    header(true); tableHead();
    data.items.forEach((item, index) => {
      font(9, false); const lines = doc.splitTextToSize(item.name, 73);
      const height = Math.max(13, lines.length * 4.4 + 6);
      if (y + height > 267) nextPage(true);
      doc.setFillColor(...(index % 2 ? [244, 248, 249] : [255, 255, 255])); doc.rect(16, y, 178, height, 'F');
      font(8.5, false, muted); doc.text(String(index + 1), 20, y + 7);
      font(9, false); doc.text(lines, 28, y + 7);
      font(8.2, false); doc.text(number(item.quantity), 122, y + 7, {align: 'right'});
      doc.text(labels.units[item.unit], 133, y + 7, {align: 'center'});
      doc.text(money(Math.round(item.price * 100)), 163, y + 7, {align: 'right'});
      doc.text(money(item.amountCents), 191, y + 7, {align: 'right'});
      doc.setDrawColor(226, 235, 238); doc.setLineWidth(0.2); doc.line(16, y + height, 194, y + height); y += height;
    });
    if (y + 37 > 267) nextPage(false);
    y += 8; doc.setFillColor(...teal); doc.roundedRect(110, y, 84, 23, 2, 2, 'F');
    font(8.5, true, [255, 255, 255]); doc.text(labels.total, 116, y + 7);
    const total = money(data.totalCents) + ' ₸'; let totalSize = 16;
    font(totalSize, true, [255, 255, 255]);
    while (doc.getTextWidth(total) > 72 && totalSize > 9) font(--totalSize, true, [255, 255, 255]);
    doc.text(total, 188, y + 17, {align: 'right'}); y += 33;
    function paragraph(text, bold) {
      font(bold ? 9 : 8.5, bold, bold ? ink : muted);
      const lines = doc.splitTextToSize(text, 178);
      for (const line of lines) {
        if (y + 5 > 267) nextPage(false);
        doc.text(line, 16, y); y += 4.5;
      }
      y += 3;
    }
    if (data.notes) {paragraph(labels.notes, true); paragraph(data.notes, false);}
    paragraph(labels.disclaimer, false);
    const count = doc.getNumberOfPages();
    for (let page = 1; page <= count; page++) {
      doc.setPage(page); doc.setDrawColor(217, 229, 232); doc.line(16, 278, 194, 278);
      font(7, false, muted); doc.text(labels.footer + ' · sarai-kz.github.io/sarai/', 16, 284);
      doc.text(labels.page + ' ' + page + ' / ' + count, 194, 284, {align: 'right'});
    }
    doc.setProperties({title: data.title, subject: labels.preliminary, author: data.author || 'SARAI', creator: 'SARAI estimate tool'});
    return {doc, filename: 'SARAI-smeta-' + data.date + '.pdf', data};
  }
  return Object.freeze({create});
}));
