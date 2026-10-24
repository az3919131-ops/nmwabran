/* شاشة الاستيراد: كاميرا أو صورة أو Excel أو PDF، ثم قراءة، ثم مراجعة قابلة للتعديل، ثم حفظ وتصدير. */
(function (g) {
  'use strict';
  const MT = g.MT;
  const U = MT.Util;
  const UI = MT.UI;
  const Store = MT.Store;
  const C = MT.Catalog;
  const P = MT.Parsers;
  const App = MT.App;
  const esc = U.esc;

  const KINDS = {
    checklist: {
      label: 'Checklist',
      title: 'قائمة Checklist',
      sub: 'المطلوب صرفه من شركة الكهرباء',
      qtyLabel: 'الكمية المطلوبة',
      tips: ['صوّر صفحة واحدة في كل مرة، والورقة مستقيمة أمامك.', 'تأكد أن أعمدة Unloading Point والحجز والكمية ظاهرة بالكامل.', 'رقم المادة الجانبي يُقرأ تلقائيًا. ما لم يُقرأ تكتبه بنفسك وتظهر لك اقتراحات.', 'يمكنك رفع ملف PDF أو Excel مُصدَّر من النظام بدل التصوير.'],
    },
    uds: {
      label: 'UDS',
      title: 'قائمة UDS',
      sub: 'المسجّل على نظام UDS',
      qtyLabel: 'الكمية المسجلة',
      tips: ['صوّر شاشة UDS أو ارفع لقطة الشاشة بدل التصوير من الجوال إن أمكن.', 'تأكد أن رقم المادة والكمية ورقم المرجع ظاهرة في كل سطر.', 'يمكنك أيضًا رفع ملف Excel أو PDF مُصدَّر من النظام، أو لصق الجدول المنسوخ بـ Ctrl+V.'],
    },
    gatepass: {
      label: 'Gate Pass',
      title: 'مستند Gate Pass',
      sub: 'المصروف فعليًا من المستودع',
      qtyLabel: 'الكمية المصروفة',
      tips: ['صوّر كل صفحة من الـ Gate Pass على حدة. الصفحات التي تحمل نفس الرقم تُضاف إلى مستند واحد.', 'تجنّب الظل واللمعان على أعمدة الأرقام، وقرّب الكاميرا من الجدول.', 'الكميات المكتوبة بخط صغير تحتاج مراجعتك. بجانب كل كمية يظهر المطلوب في الـ Checklist للمقارنة.', 'يمكنك رفع ملف PDF أو Excel بدل التصوير. الـ PDF النصي يُقرأ مباشرة.'],
    },
  };

  const FLAG_ICON = { bad: '✕', warn: '▲', ok: '●' };
  const drafts = {};
  const fresh = () => ({ step: 'source', src: null, file: null, blob: null, rotation: 0, auto: true, useAI: false, busy: null, rows: [], header: {}, warnings: [], matrix: null, mapping: {}, headerIndex: -1, sheetName: '', note: '', mode: 'merge', previewUrl: '', readInfo: '', doc: null, abort: null });
  const D = (k) => (drafts[k] = drafts[k] || fresh());
  // مسودة مشروع لا تنتقل إلى مشروع آخر
  Store.on('project', () => Object.keys(drafts).forEach((k) => delete drafts[k]));

  let kind = 'checklist';
  let rootEl = null;
  let savedTables = {};

  const ctxFor = () => {
    const res = [...new Set(Store.data.checklist.map((r) => r.reservation).filter(Boolean))];
    const resCodes = {};
    Store.data.checklist.forEach((r) => {
      if (!r.reservation) return;
      const set = (resCodes[r.reservation] = resCodes[r.reservation] || []);
      if (!set.includes(r.code)) set.push(r.code);
    });
    return { reservations: res.length ? res : null, resCodes };
  };

  const view = {
    title: 'استيراد القوائم',
    async render(root, ctx) {
      rootEl = root;
      kind = KINDS[ctx.params[0]] ? ctx.params[0] : 'checklist';
      savedTables = {};
      const k = KINDS[kind];
      root.innerHTML = `<div class="page">
        <header class="page-head">
          <div><h1 class="h1">استيراد القوائم</h1>
          <p class="lead">صوّر القائمة أو ارفعها. تظهر لك الأرقام المقروءة لتصحيحها قبل الحفظ.</p></div>
        </header>
        <div class="tabs" role="tablist" aria-label="نوع القائمة">${Object.entries(KINDS)
          .map(([id, x]) => `<a role="tab" class="tab tab-${id}" href="#/import/${id}" aria-selected="${id === kind}"><span>${x.label}</span><small>${x.sub}</small></a>`)
          .join('')}</div>
        <div id="wizard" class="section-sm"></div>
        <div id="saved" class="section-sm"></div>
      </div>`;
      drawWizard();
      drawSaved();
    },
    onChange() {
      drawSaved();
    },
  };

  /* ====================== المعالج ====================== */
  function stepsBar(active) {
    const src = D(kind).src;
    const s = ['١. اختر المصدر', src === 'excel' || src === 'text' ? (src === 'text' ? '٢. جهّز النص' : '٢. جهّز الملف') : src && src !== 'image' ? '٢. جهّز الملف' : '٢. جهّز الصورة', '٣. راجع واحفظ'];
    return `<ol class="wz-steps" aria-label="خطوات الاستيراد">${s.map((t, i) => `<li class="${i + 1 === active ? 'is-current' : i + 1 < active ? 'is-done' : ''}" ${i + 1 === active ? 'aria-current="step"' : ''}>${t}</li>`).join('')}</ol>`;
  }

  function drawWizard() {
    const host = rootEl.querySelector('#wizard');
    const d = D(kind);
    if (d.step === 'source') drawSource(host, d);
    else if (d.step === 'prepare') drawPrepare(host, d);
    else drawReview(host, d);
  }

  /* ====== مصادر الاستيراد: كاميرا، صورة أو PowerPoint، Excel أو PDF، لصق ====== */
  const DOC_TYPES = { pdf: 'ملف PDF', pptx: 'عرض PowerPoint', docx: 'مستند Word', text: 'نص ملصوق' };

  /** حالة القراءة الذكية: سطر أعلى الإرشادات في شاشة المصدر */
  function aiStrip() {
    const AI = MT.AI;
    if (AI.hasKey() && AI.isEnabled()) return `<div class="ai-strip is-on"><span class="ai-dot" aria-hidden="true"></span><p><strong>القراءة الدقيقة بالذكاء الاصطناعي مفعّلة</strong> (${esc(AI.label(AI.getModel()))}). تعمل مع الصور وPDF وPowerPoint وWord والنص الملصوق، ثم تُراجَع الصفوف المشكوك فيها مرة ثانية.</p><button type="button" class="btn btn-sm" data-ai-setup>الإعدادات</button></div>`;
    if (AI.hasKey()) return `<div class="ai-strip"><span class="ai-dot" aria-hidden="true"></span><p><strong>القراءة الدقيقة موقوفة.</strong> تُقرأ الصور والملفات محليًا بدقة أقل.</p><button type="button" class="btn btn-sm" data-ai-on>فعّلها</button></div>`;
    return `<div class="ai-strip"><span class="ai-dot" aria-hidden="true"></span><p><strong>القراءة هنا محلية ومجانية.</strong> للحصول على قراءة أدق للصور وخط اليد أضف مفتاح Anthropic API.</p><button type="button" class="btn btn-sm" data-ai-setup>أضف المفتاح</button></div>`;
  }

  function drawSource(host, d) {
    const k = KINDS[kind];
    host.innerHTML = `<section class="card wizard" aria-labelledby="wz-h">
      ${stepsBar(1)}
      <h2 id="wz-h" class="h3">أضف ${k.title}</h2>
      <div class="dropzone" id="drop">
        <div class="source-btns">
          <button type="button" class="src-btn src-btn-cam" data-pick="cam">${UI.icon('camera', 34)}<strong>صوّر بالكاميرا</strong><small>على الجوال تفتح الكاميرا مباشرة</small></button>
          <button type="button" class="src-btn" data-pick="img">${UI.icon('image', 34)}<strong>ارفع صورة أو PPT</strong><small>JPG أو PNG أو لقطة شاشة أو عرض PowerPoint</small></button>
          <button type="button" class="src-btn" data-pick="xls">${UI.icon('sheet', 34)}<strong>ارفع Excel أو PDF</strong><small>ملف مُصدَّر من النظام</small></button>
          <button type="button" class="src-btn" data-pick="paste">${UI.icon('paste', 34)}<strong>الصق</strong><small>نص أو جدول منسوخ أو لقطة شاشة أو ملف (Ctrl+V)</small></button>
        </div>
        <input type="file" id="f-cam" accept="image/*" capture="environment" hidden>
        <input type="file" id="f-img" accept="image/*,.pptx,.ppt,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint" hidden>
        <input type="file" id="f-xls" accept=".xlsx,.xls,.csv,.pdf,.docx,.txt,text/csv,application/pdf" hidden>
        <p class="dz-hint">أو اسحب أي ملف وأفلته هنا، أو اضغط Ctrl+V في أي مكان من الصفحة للصق.</p>
      </div>
      ${aiStrip()}
      <ul class="tips">${k.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
    </section>`;
    const pick = (id) => host.querySelector('#' + id).click();
    // معالج واحد يُستبدل عند كل إعادة رسم، حتى لا تتراكم المعالجات على الحاوية نفسها
    host.onclick = async (e) => {
      const el = e.target.closest('[data-pick], [data-ai-setup], [data-ai-on]');
      if (!el || !host.contains(el)) return;
      if (el.dataset.pick === 'paste') pasteFromClipboard();
      else if (el.dataset.pick) pick({ cam: 'f-cam', img: 'f-img', xls: 'f-xls' }[el.dataset.pick]);
      else if (el.hasAttribute('data-ai-setup')) {
        await App.openSettings();
        drawWizard();
      } else {
        MT.AI.setEnabled(true);
        drawWizard();
      }
    };
    ['f-cam', 'f-img', 'f-xls'].forEach((id) =>
      host.querySelector('#' + id).addEventListener('change', (e) => {
        const f = e.target.files[0];
        e.target.value = '';
        if (f) handleFile(f);
      })
    );
    const dz = host.querySelector('#drop');
    ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => (e.preventDefault(), dz.classList.add('is-over'))));
    ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => (e.preventDefault(), dz.classList.remove('is-over'))));
    dz.addEventListener('drop', (e) => {
      const files = [...(e.dataTransfer.files || [])];
      const text = e.dataTransfer.getData('text/plain');
      if (files.length || text) handlePasted({ files, text });
    });
  }

  /* ----- اللصق ----- */
  const typeOf = (f) => {
    const n = f.name || '';
    if (/\.pdf$/i.test(n) || f.type === 'application/pdf') return 'pdf';
    if (/\.(pptx|ppt)$/i.test(n) || /presentationml|ms-powerpoint/.test(f.type)) return 'pptx';
    if (/\.(docx|doc)$/i.test(n) || /wordprocessingml|msword/.test(f.type)) return 'docx';
    if (/\.(xlsx|xls|csv)$/i.test(n) || /spreadsheet|excel|csv/.test(f.type)) return 'excel';
    if (/^image\//.test(f.type) || /\.(jpe?g|png|webp|heic|gif|bmp)$/i.test(n)) return 'image';
    if (/\.txt$/i.test(n) || f.type === 'text/plain') return 'txt';
    return '';
  };

  /** ما في الحافظة أو المُسقَط: ملف غير صورة أولًا، ثم النص، ثم الصورة */
  async function handlePasted({ files = [], text = '' }) {
    const other = files.find((f) => typeOf(f) && typeOf(f) !== 'image');
    if (other) return handleFile(other);
    if (text && text.trim().length >= 3) return handleText(text);
    const img = files.find((f) => typeOf(f) === 'image');
    if (img) return handleFile(img);
    if (files.length) return handleFile(files[0]);
    UI.toast('لم أجد شيئًا للصقه. انسخ نصًا أو جدولًا أو صورة أو ملفًا ثم حاول مرة أخرى.', { type: 'error', ms: 6000 });
  }

  async function pasteFromClipboard() {
    const cb = navigator.clipboard;
    if (cb && cb.read) {
      try {
        const items = await cb.read();
        let text = '';
        const files = [];
        for (const it of items) {
          for (const type of it.types) {
            if (type === 'text/plain') text = await (await it.getType(type)).text();
            else if (/^image\//.test(type)) files.push(new File([await it.getType(type)], 'clipboard.' + type.split('/')[1].replace('jpeg', 'jpg'), { type }));
          }
        }
        if (text.trim() || files.length) return handlePasted({ files, text });
        return UI.toast('الحافظة فارغة. انسخ نصًا أو جدولًا أو صورة ثم اضغط «الصق».', { type: 'error', ms: 6000 });
      } catch (e) {
        /* رُفض الإذن أو غير مدعوم: نفتح مربع اللصق */
      }
    }
    openPasteDialog();
  }

  async function openPasteDialog() {
    let go = null;
    await UI.dialog({
      title: 'الصق ما نسخته',
      size: 'md',
      body: `<p class="dlg-text">اضغط داخل المربع ثم Ctrl+V (أو اضغط مطولًا واختر «لصق» على الجوال). يمكنك لصق جدول منسوخ من Excel، أو نص من أي برنامج، أو لقطة شاشة، أو ملف منسوخ من الجهاز.</p>
        <label class="field"><span class="field-label">المحتوى الملصوق</span><textarea class="input paste-box" id="paste-box" rows="8" dir="auto" placeholder="الصق هنا"></textarea></label>`,
      actions: [
        { label: 'إلغاء', value: false },
        { label: 'اقرأ النص', kind: 'primary', value: true, noClose: true, onClick: (dlg) => (go = dlg.querySelector('#paste-box').value) != null && dlg.close('1') },
      ],
      onOpen: (dlg) => {
        const box = dlg.querySelector('#paste-box');
        box.focus();
        box.addEventListener('paste', (e) => {
          const cd = e.clipboardData;
          if (!cd) return;
          const files = [...cd.files];
          const text = cd.getData('text/plain');
          if (files.length && !text.trim()) {
            e.preventDefault();
            go = { files };
            dlg.close('1');
          } else if (files.some((f) => typeOf(f) && typeOf(f) !== 'image')) {
            e.preventDefault();
            go = { files };
            dlg.close('1');
          } else if (!box.value.trim() && text.trim()) {
            e.preventDefault();
            go = text;
            dlg.close('1');
          }
        });
      },
    });
    if (go == null) return;
    if (typeof go === 'string') return go.trim() ? handleText(go) : UI.toast('اكتب أو الصق شيئًا أولًا.', { type: 'error' });
    return handlePasted(go);
  }

  /** نص ملصوق: جدول بعلامات Tab يذهب إلى ربط الأعمدة، وغيره يُقرأ كأسطر */
  function handleText(raw) {
    const d = D(kind);
    const text = String(raw).replace(/\r/g, '').replace(/ /g, ' ');
    const lines = text.split('\n').filter((l) => l.trim());
    if (!lines.length) return UI.toast('النص فارغ.', { type: 'error' });
    if (d.previewUrl) URL.revokeObjectURL(d.previewUrl);
    releaseDoc(d);
    if (lines.length >= 2 && lines.filter((l) => l.includes('\t')).length >= Math.ceil(lines.length / 2)) {
      const matrix = lines.map((l) => l.split('\t').map((c) => c.trim()));
      const tb = P.detectTable(matrix);
      let headerIndex = tb.headerIndex;
      let mapping = tb.mapping;
      if (headerIndex < 0) {
        const cols = Math.max(...matrix.map((r) => r.length));
        matrix.unshift(Array.from({ length: cols }, (_, i) => 'عمود ' + String.fromCharCode(65 + (i % 26))));
        headerIndex = 0;
        mapping = {};
      }
      Object.assign(d, fresh(), { step: 'prepare', src: 'excel', file: { name: 'الحافظة', size: text.length }, matrix, sheetName: 'الحافظة', headerIndex, mapping });
    } else {
      Object.assign(d, fresh(), { step: 'prepare', src: 'text', doc: docFromText(text, lines), useAI: MT.AI.isEnabled() });
    }
    drawWizard();
  }

  /* ----- المستندات متعددة الصفحات (PDF وPowerPoint وWord والنص) ----- */
  const toLines = (arr) => arr.map((t, i) => ({ text: t, bbox: { x0: 0, y0: i * 10, x1: 0, y1: i * 10 + 9 }, confidence: 100 }));

  function docFromText(text, lines) {
    return {
      type: 'text',
      file: null,
      summary: `${U.fmt(lines.length, 0)} سطرًا`,
      note: 'يُقرأ النص مباشرة. الأسطر التي فيها كود المادة والكمية تتحول إلى صفوف تراجعها قبل الحفظ.',
      textual: true,
      lines: toLines(lines),
      preview: null,
      previewText: lines.slice(0, 40).join('\n') + (lines.length > 40 ? '\n...' : ''),
      aiInputs: () => [{ type: 'text', text, label: 'Text pasted by the user (columns may be separated by tabs or spaces)' }],
      ocrBlobs: async () => [],
      firstImage: async () => null,
      release() {},
    };
  }

  function docFromPdf(file, info) {
    return {
      type: 'pdf',
      file,
      summary: `${info.pageCount} ${info.pageCount === 1 ? 'صفحة' : 'صفحات'}${info.pageCount > info.usedPages ? ` (تُقرأ أول ${info.usedPages} فقط)` : ''}`,
      note: info.textual ? 'الملف يحتوي نصًا مضمّنًا، فيُقرأ مباشرة دون تعرّف ضوئي.' : 'الملف صورة ممسوحة بلا نص مضمّن، فيُقرأ بالتعرّف الضوئي وقد تحتاج مراجعة بعض الأرقام.',
      textual: info.textual,
      lines: info.lines,
      preview: info.preview,
      aiInputs: () => [{ type: 'pdf', blob: file }],
      ocrBlobs: (onStep) => MT.PDF.renderAll(info.doc, info.usedPages, onStep),
      firstImage: (w) => MT.PDF.renderPage(info.doc, 1, w),
      release() {
        if (info.doc && info.doc.destroy) info.doc.destroy().catch(() => {});
      },
    };
  }

  function docFromOffice(type, file, info) {
    const what = type === 'pptx' ? 'عرض' : 'مستند';
    const unit = type === 'pptx' ? (info.slides === 1 ? 'شريحة' : 'شرائح') : 'مستند';
    return {
      type,
      file,
      summary: `${type === 'pptx' ? info.slides + ' ' + unit + '، ' : ''}${info.images.length} ${info.images.length === 1 ? 'صورة' : 'صور'}، ${U.fmt(info.lines.length, 0)} سطر نص${info.skipped ? ` (تخطّيت ${info.skipped} صورة بصيغة لا يقرؤها المتصفح)` : ''}`,
      note: info.textual ? `وجدت نصًا في ال${what}، فيُقرأ مباشرة وتُقرأ صوره عند الحاجة.` : info.images.length ? `ال${what} يحتوي صورًا (لقطات شاشة)، فتُقرأ بالتعرّف الضوئي أو بالذكاء الاصطناعي.` : `لم أجد في ال${what} نصًا ولا صورًا يمكن قراءتها.`,
      textual: info.textual,
      lines: info.lines,
      preview: info.preview,
      aiInputs: () => [...info.images.map((i) => ({ type: 'image', blob: i.blob })), ...(info.lines.length ? [{ type: 'text', text: info.lines.map((l) => l.text).join('\n'), label: 'Text found in the document' }] : [])],
      ocrBlobs: async () => info.images.map((i) => i.blob),
      firstImage: async () => (info.images[0] ? info.images[0].blob : null),
      release() {},
    };
  }

  function releaseDoc(d) {
    if (d.doc && d.doc.release) d.doc.release();
    d.doc = null;
  }

  async function handleFile(file) {
    const d = D(kind);
    const hint = rootEl && rootEl.querySelector('.dz-hint');
    const keep = hint ? hint.textContent : '';
    const t = typeOf(file);
    try {
      if (!t) throw new Error('نوع الملف غير مدعوم. ارفع ملف Excel أو PDF أو PowerPoint أو Word أو صورة أو نصًا.');
      if (t === 'pdf' || t === 'pptx' || t === 'docx') {
        if (hint) hint.textContent = 'جارٍ فتح الملف...';
        const info = t === 'pdf' ? await MT.PDF.inspect(file) : t === 'pptx' ? await MT.Office.inspectPptx(file) : await MT.Office.inspectDocx(file);
        if (t !== 'pdf' && !info.lines.length && !info.images.length) throw new Error('لم أجد في الملف نصًا ولا صورًا يمكن قراءتها.');
        if (d.previewUrl) URL.revokeObjectURL(d.previewUrl);
        releaseDoc(d);
        const doc = t === 'pdf' ? docFromPdf(file, info) : docFromOffice(t, file, info);
        Object.assign(d, fresh(), { step: 'prepare', src: t, file, doc, useAI: MT.AI.isEnabled(), previewUrl: doc.preview ? URL.createObjectURL(doc.preview) : '' });
      } else if (t === 'excel') {
        const { matrix, sheetName } = await MT.Excel.readMatrix(file);
        if (!matrix.length) throw new Error('الملف فارغ.');
        const tb = P.detectTable(matrix);
        Object.assign(d, fresh(), { step: 'prepare', src: 'excel', file, matrix, sheetName, headerIndex: Math.max(tb.headerIndex, 0), mapping: tb.mapping });
      } else if (t === 'txt') {
        return handleText(await file.text());
      } else {
        if (d.previewUrl) URL.revokeObjectURL(d.previewUrl);
        releaseDoc(d);
        Object.assign(d, fresh(), { step: 'prepare', src: 'image', file, blob: file, useAI: MT.AI.isEnabled() });
        await refreshPreview(d);
      }
      drawWizard();
    } catch (e) {
      if (hint) hint.textContent = keep;
      UI.toast(e.message || String(e), { type: 'error', ms: 7000 });
    }
  }

  async function refreshPreview(d) {
    const blob = await UI.imageToBlob(d.blob, { maxSide: 1100, quality: 0.8, rotate: d.rotation });
    if (d.previewUrl) URL.revokeObjectURL(d.previewUrl);
    d.previewUrl = URL.createObjectURL(blob);
  }

  /* ----- الخطوة 2: تجهيز الصورة أو المستند ----- */
  const isDoc = (d) => !!d.doc;

  function aiBlock(d) {
    const AI = MT.AI;
    if (AI.hasKey()) {
      return `<label class="check"><input type="checkbox" id="use-ai" ${d.useAI ? 'checked' : ''} ${d.busy ? 'disabled' : ''}><span>قراءة دقيقة بالذكاء الاصطناعي (${esc(AI.label(AI.getModel()))})</span></label>
        <p class="note note-soft">${d.useAI ? 'يُرسل المحتوى إلى Anthropic ليُقرأ، ثم تُراجَع الصفوف المشكوك فيها مرة ثانية تلقائيًا. إن تعذّرت القراءة الذكية تُقرأ محليًا.' : 'القراءة المحلية مجانية لكنها أقل دقة مع الصور المائلة وخط اليد.'}</p>`;
    }
    return `<div class="note"><strong>القراءة الدقيقة بالذكاء الاصطناعي غير مفعّلة.</strong> أضف مفتاح Anthropic API لقراءة أدق للصور المائلة وخط اليد والجداول الطويلة.<div class="row-actions"><button type="button" class="btn btn-sm" id="ai-setup">أضف المفتاح</button></div></div>`;
  }

  function drawPrepare(host, d) {
    if (d.src === 'excel') return drawMapping(host, d);
    const doc = d.doc;
    const img = !isDoc(d);
    const figure = img
      ? `<figure class="prep-img"><img id="prev" decoding="async" src="${d.previewUrl}" alt="معاينة صورة ${KINDS[kind].title}"></figure>`
      : d.previewUrl
        ? `<figure class="prep-img"><img id="prev" decoding="async" src="${d.previewUrl}" alt="معاينة الصفحة الأولى من ${DOC_TYPES[doc.type]} ${KINDS[kind].title}"></figure>`
        : doc.previewText
          ? `<figure class="prep-img prep-text"><pre dir="auto" tabindex="0" aria-label="معاينة النص">${esc(doc.previewText)}</pre></figure>`
          : '';
    const meta = img
      ? `<p class="muted mono" dir="ltr">${esc(d.file.name || 'camera.jpg')} (${(d.file.size / 1024).toFixed(0)} KB)</p>`
      : `<p class="muted"><strong>${esc(DOC_TYPES[doc.type])}</strong>${doc.file ? ` <span class="mono" dir="ltr">${esc(doc.file.name)} (${(doc.file.size / 1024).toFixed(0)} KB)</span>` : ''}</p><p><strong>${esc(doc.summary)}</strong></p><p class="note">${esc(doc.note)}</p>`;
    host.innerHTML = `<section class="card wizard" aria-labelledby="wz-h">
      ${stepsBar(2)}
      <h2 id="wz-h" class="h3">${img ? 'جهّز الصورة' : doc.type === 'text' ? 'جهّز النص' : 'جهّز الملف'}</h2>
      <div class="prep ${figure ? '' : 'prep-solo'}">
        ${figure}
        <div class="prep-side">
          ${meta}
          ${img ? `<div class="row-actions">
            <button type="button" class="btn" id="rot-l" ${d.busy ? 'disabled' : ''}>${UI.icon('rotl', 20)}<span>دوّر يسارًا</span></button>
            <button type="button" class="btn" id="rot-r" ${d.busy ? 'disabled' : ''}>${UI.icon('rotr', 20)}<span>دوّر يمينًا</span></button>
          </div>
          <label class="check"><input type="checkbox" id="auto" ${d.auto ? 'checked' : ''} ${d.busy ? 'disabled' : ''}><span>اكتشف اتجاه الصورة تلقائيًا</span></label>` : ''}
          ${aiBlock(d)}
          <div class="row-actions">
            <button type="button" class="btn btn-primary" id="read" ${d.busy ? 'disabled' : ''}>${UI.icon('spark', 20)}<span>${img ? 'اقرأ الصورة' : doc.type === 'text' ? 'اقرأ النص' : 'اقرأ الملف'}</span></button>
            <button type="button" class="btn" id="skip" ${d.busy ? 'disabled' : ''}>${UI.icon('edit', 20)}<span>أدخل البيانات يدويًا</span></button>
            <button type="button" class="btn btn-ghost" id="back" ${d.busy ? 'disabled' : ''}>${img ? 'اختر ملفًا آخر' : 'اختر مصدرًا آخر'}</button>
          </div>
          <div class="progress-box" id="prog" ${d.busy ? '' : 'hidden'} role="status" aria-live="polite"><div class="progress progress-lg"><span id="prog-bar" style="width:${d.busy ? d.busy.pct : 0}%"></span></div><p id="prog-text" class="muted">${d.busy ? esc(d.busy.text) : ''}</p><div class="row-actions"><button type="button" class="btn btn-sm" id="cancel-read">ألغِ القراءة</button></div></div>
        </div>
      </div>
    </section>`;
    if (img) {
      host.querySelector('#rot-l').onclick = () => rotate(d, -90);
      host.querySelector('#rot-r').onclick = () => rotate(d, 90);
      host.querySelector('#auto').onchange = (e) => (d.auto = e.target.checked);
    }
    const ai = host.querySelector('#use-ai');
    if (ai)
      ai.onchange = (e) => {
        d.useAI = e.target.checked;
        MT.AI.setEnabled(d.useAI);
        drawWizard();
      };
    const setup = host.querySelector('#ai-setup');
    if (setup)
      setup.onclick = async () => {
        await App.openSettings();
        d.useAI = MT.AI.isEnabled();
        drawWizard();
      };
    host.querySelector('#back').onclick = () => {
      if (d.previewUrl) URL.revokeObjectURL(d.previewUrl);
      releaseDoc(d);
      Object.assign(d, fresh());
      drawWizard();
    };
    host.querySelector('#skip').onclick = () => {
      d.rows = [];
      d.header = kind === 'gatepass' ? { date: U.today() } : {};
      d.step = 'review';
      d.readInfo = 'أُدخلت البيانات يدويًا.';
      drawWizard();
    };
    host.querySelector('#read').onclick = () => runRead(host, d);
    host.querySelector('#cancel-read').onclick = () => {
      d.run = (d.run || 0) + 1;
      if (d.abort) d.abort.abort();
      d.busy = null;
      MT.OCR.dispose();
      drawWizard();
      UI.toast('أُلغيت القراءة.', { type: 'info', ms: 2500 });
    };
  }

  const parseLocal = (L, ctx) => (kind === 'checklist' ? P.parseChecklist(L, ctx) : kind === 'gatepass' ? P.parseGatePass(L, ctx) : P.parseUds(L, ctx));

  /** القراءة بالذكاء الاصطناعي أولًا إن فُعّلت، وعند تعذرها قراءة محلية مع تنبيه واضح */
  async function readSource(d, setBusy) {
    const ctx = ctxFor();
    const warn = [];
    d.abort = new AbortController();
    if (d.useAI && MT.AI.hasKey()) {
      try {
        const inputs = isDoc(d) ? d.doc.aiInputs() : [{ type: 'image', blob: d.blob, rotate: d.auto ? 0 : d.rotation }];
        const out = await MT.AI.read(kind, inputs, { ctx, signal: d.abort.signal, onStatus: (s) => setBusy(s.pct, s.text) });
        return { parsed: out.parsed, ai: out };
      } catch (e) {
        if (e.code === 'aborted') throw e;
        warn.push(`تعذّرت القراءة الدقيقة بالذكاء الاصطناعي: ${e.message} قُرئ المحتوى محليًا، فراجع الأرقام بعناية أكبر.`);
        setBusy(10, 'تحويل إلى القراءة المحلية...');
      }
    }
    let out;
    if (isDoc(d)) {
      const doc = d.doc;
      if (doc.textual) {
        setBusy(40, 'قراءة النص مباشرة...');
        const parsed = parseLocal({ lines: doc.lines }, ctx);
        if (parsed.rows.length) out = { parsed, direct: true };
        else setBusy(45, 'لا صفوف في النص. أجرّب التعرّف الضوئي على الصور...');
      }
      if (!out) {
        setBusy(8, 'تجهيز الصور...');
        const blobs = await doc.ocrBlobs((n, N) => setBusy(8 + Math.round((n / N) * 10), `تجهيز الصفحة ${n} من ${N}...`));
        if (blobs.length) {
          const r = await MT.OCR.readMany(kind, blobs, { rotation: 'auto', upright: doc.type === 'pdf', onStatus: (s) => setBusy(Math.max(18, Math.round(18 + s.pct * 0.82)), s.text), ctx });
          out = { parsed: r.parsed };
        } else out = { parsed: { rows: [], header: {}, warnings: [] } };
      }
    } else {
      const r = await MT.OCR.read(kind, d.blob, { rotation: d.auto ? 'auto' : d.rotation, onStatus: (s) => setBusy(s.pct, s.text), ctx });
      if (d.auto && r.rotation !== d.rotation) {
        d.rotation = r.rotation;
        await refreshPreview(d);
      }
      out = { parsed: r.parsed };
    }
    out.parsed.warnings = [...warn, ...(out.parsed.warnings || [])];
    return out;
  }

  async function rotate(d, delta) {
    d.auto = false;
    d.rotation = (d.rotation + delta + 360) % 360;
    await refreshPreview(d);
    drawWizard();
  }

  async function runRead(host, d) {
    const run = (d.run = (d.run || 0) + 1);
    d.busy = { pct: 2, text: 'جارٍ البدء...' };
    const setBusy = (pct, text) => {
      if (d.run !== run) return;
      d.busy = { pct, text };
      const bar = rootEl.querySelector('#prog-bar');
      const t = rootEl.querySelector('#prog-text');
      if (bar) bar.style.width = pct + '%';
      if (t) t.textContent = text;
    };
    drawWizard();
    try {
      const out = await readSource(d, setBusy);
      if (d.run !== run) return;
      d.rows = out.parsed.rows;
      d.header = out.parsed.header || {};
      if (kind === 'gatepass' && !d.header.date) d.header.date = U.today();
      d.warnings = out.parsed.warnings || [];
      if (out.ai) {
        const a = out.ai;
        d.readInfo = `قراءة دقيقة بـ ${MT.AI.label(a.model)}${a.verified ? `، مع مراجعة ثانية لـ ${a.verified} صفًا` : ''}. التكلفة التقريبية ${a.cost < 0.01 ? 'أقل من سنت' : '$' + a.cost.toFixed(2)}.`;
      } else if (out.direct) d.readInfo = 'قُرئ النص المضمّن مباشرة. راجع الأرقام قبل الحفظ.';
      else d.readInfo = 'قراءة محلية مجانية. دقتها تتأثر بجودة الصورة، فراجع كل رقم.';
      d.busy = null;
      d.step = 'review';
      drawWizard();
      const bad = d.rows.filter((r) => P.flagLevel(r.flags) === 'bad').length;
      UI.toast(d.rows.length ? `قُرئ ${d.rows.length} صفًا${bad ? `، منها ${bad} يحتاج إكمالًا` : ''}.` : isDoc(d) ? 'لم أجد صفوفًا في المحتوى. تأكد أنه القائمة الصحيحة أو أدخل البيانات يدويًا.' : 'لم أجد صفوفًا في الصورة. أعد التصوير أو أدخل البيانات يدويًا.', { type: d.rows.length ? 'ok' : 'error', ms: 7000 });
    } catch (e) {
      if (d.run !== run || (e && e.code === 'aborted')) return;
      console.error(e);
      d.busy = null;
      drawWizard();
      UI.toast(e.message || String(e), { type: 'error', ms: 9000 });
    }
  }

  /* ----- ربط أعمدة Excel ----- */
  const MAP_FIELDS = {
    checklist: [['code', 'كود المادة', true], ['qty', 'الكمية المطلوبة', true], ['desc', 'الوصف'], ['reservation', 'رقم الحجز'], ['item_no', 'البند'], ['unloading', 'Unloading Point أو أمر العمل']],
    uds: [['code', 'كود المادة', true], ['qty', 'الكمية المسجلة', true], ['desc', 'الوصف'], ['reference', 'رقم المرجع'], ['reservation', 'رقم الحجز']],
    gatepass: [['code', 'كود المادة', true], ['qty', 'الكمية المصروفة', true], ['gp_no', 'رقم Gate Pass'], ['date', 'التاريخ'], ['item_no', 'رقم السطر'], ['reservation', 'رقم الحجز'], ['desc', 'الوصف']],
  };

  function drawMapping(host, d) {
    const headers = d.matrix[d.headerIndex] || [];
    const opts = (sel) =>
      `<option value="">لا يوجد</option>${headers.map((h, i) => `<option value="${i}" ${sel === i ? 'selected' : ''}>${esc(String.fromCharCode(65 + (i % 26)))}: ${esc(h == null ? '(فارغ)' : h)}</option>`).join('')}`;
    const prev = d.matrix.slice(d.headerIndex + 1, d.headerIndex + 6);
    host.innerHTML = `<section class="card wizard" aria-labelledby="wz-h">
      ${stepsBar(2)}
      <h2 id="wz-h" class="h3">اربط أعمدة الملف</h2>
      <p class="muted">الورقة «${esc(d.sheetName)}» فيها ${U.fmt(d.matrix.length - d.headerIndex - 1, 0)} صفًا. حدّدتُ الأعمدة تلقائيًا، فصحّح ما يلزم.</p>
      <div class="map-grid">${MAP_FIELDS[kind].map(([f, label, req]) => `<label class="field"><span class="field-label">${esc(label)}${req ? ' *' : ''}</span><select class="input" data-map="${f}">${opts(d.mapping[f])}</select></label>`).join('')}
        <label class="field"><span class="field-label">صف العناوين</span><input class="input mono" type="number" min="1" max="${Math.min(d.matrix.length, 50)}" id="hdr-row" value="${d.headerIndex + 1}"></label></div>
      <div class="table-wrap"><table class="table table-sm preview"><caption class="sr-only">معاينة أول الصفوف</caption><thead><tr>${headers.map((h) => `<th scope="col">${esc(h == null ? '' : h)}</th>`).join('')}</tr></thead><tbody>${prev.map((r) => `<tr>${headers.map((_, i) => `<td data-label="${esc(headers[i] || '')}"><span class="mono" dir="ltr">${esc(r[i] instanceof Date ? U.isoDate(r[i]) : r[i] == null ? '' : r[i])}</span></td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <div class="row-actions"><button type="button" class="btn btn-primary" id="to-review">${UI.icon('check', 20)}<span>حوّل إلى جدول المراجعة</span></button><button type="button" class="btn btn-ghost" id="back">اختر ملفًا آخر</button></div>
    </section>`;
    host.querySelectorAll('[data-map]').forEach((s) =>
      s.addEventListener('change', () => {
        if (s.value === '') delete d.mapping[s.dataset.map];
        else d.mapping[s.dataset.map] = Number(s.value);
      })
    );
    host.querySelector('#hdr-row').addEventListener('change', (e) => {
      d.headerIndex = Math.max(0, Number(e.target.value) - 1);
      d.mapping = P.guessMapping(d.matrix[d.headerIndex] || []);
      drawWizard();
    });
    host.querySelector('#back').onclick = () => {
      Object.assign(d, fresh());
      drawWizard();
    };
    host.querySelector('#to-review').onclick = () => {
      if (d.mapping.code == null || d.mapping.qty == null) return UI.toast('اختر عمود كود المادة وعمود الكمية.', { type: 'error' });
      const out = P.tableToRows(kind, d.matrix, d.headerIndex, d.mapping, ctxFor());
      if (!out.rows.length) return UI.toast('لم أجد صفوفًا صالحة. راجع صف العناوين وربط الأعمدة.', { type: 'error' });
      d.rows = out.rows;
      d.warnings = out.warnings;
      if (kind === 'gatepass') {
        const first = out.rows.find((r) => r.gp_no) || {};
        d.header = { no: first.gp_no || '', date: (out.rows.find((r) => r.date) || {}).date || U.today() };
      }
      d.readInfo = d.file.name === 'الحافظة' ? 'من الجدول الملصوق.' : `من ملف ${d.file.name}`;
      d.step = 'review';
      drawWizard();
    };
  }

  /* ----- الخطوة 3: المراجعة ----- */
  const existsKey = (r) => {
    if (kind === 'checklist') return Store.data.checklist.some((x) => x.code === r.code && (x.reservation || '') === (r.reservation || '') && (x.item_no || '') === (r.item_no || '') && (x.work_order || '') === (r.work_order || ''));
    if (kind === 'uds') return Store.data.uds.some((x) => x.code === r.code && (x.reference || '') === (r.reference || '') && (x.reservation || '') === (r.reservation || ''));
    return false;
  };
  const clRequired = (r) => {
    if (!r.code) return null;
    const hit = Store.data.checklist.filter((x) => x.code === r.code && (!r.reservation || x.reservation === r.reservation));
    return hit.length ? U.sum(hit, (x) => x.qty) : null;
  };

  function recheck(r, edited) {
    const flags = new Set(r.flags || []);
    const drop = (...fs) => fs.forEach((f) => flags.delete(f));
    if (edited === 'code') drop('code_fixed', 'code_inferred', 'code_missing', 'code_unknown');
    if (edited === 'qty') drop('qty_missing', 'qty_unclear', 'qty_inferred', 'sub_mismatch');
    if (edited === 'reservation') drop('res_missing', 'res_inferred', 'res_unknown', 'wo_fixed');
    if (!r.code) flags.add('code_missing');
    else if (!C.get(r.code)) {
      flags.add('code_unknown');
      const near = C.nearest(r.code, 1);
      r.suggest = near.length === 1 ? near[0].code : '';
    } else {
      drop('code_unknown', 'code_missing');
      r.suggest = '';
    }
    if (r.qty == null || !Number.isFinite(r.qty)) flags.add('qty_missing');
    else drop('qty_missing', 'qty_unclear');
    const known = ctxFor().reservations;
    if (kind !== 'checklist' && known && r.reservation && !known.includes(r.reservation)) flags.add('res_unknown');
    else drop('res_unknown');
    r.flags = [...flags];
  }

  function rowHtml(r, i) {
    const it = C.get(r.code);
    const level = P.flagLevel(r.flags);
    const sugg = [r.suggest, ...(r.suggestions || [])].filter(Boolean).filter((v, j, a) => a.indexOf(v) === j && v !== r.code);
    const field = (f, label, extra = '') => `<td data-label="${label}"><input class="input mono" dir="ltr" data-f="${f}" data-i="${i}" value="${esc(r[f] == null ? '' : r[f])}" ${extra} aria-label="${label} للصف ${i + 1}"></td>`;
    const hint = kind === 'gatepass' ? clRequired(r) : null;
    const cells = {
      checklist: [field('reservation', 'رقم الحجز', 'inputmode="numeric"'), field('work_order', 'أمر العمل', 'inputmode="numeric"'), field('item_no', 'البند', 'inputmode="numeric"')],
      uds: [field('reference', 'رقم المرجع'), field('reservation', 'رقم الحجز', 'inputmode="numeric"')],
      gatepass: [field('reservation', 'رقم الحجز', 'inputmode="numeric"'), field('line_no', 'رقم السطر', 'inputmode="numeric"')],
    }[kind].join('');
    return `<tr class="rv rv-${level}" data-row="${i}">
      <td data-label="#" class="rv-n mono">${i + 1}</td>
      <td data-label="كود المادة" class="rv-code"><input class="input mono" dir="ltr" inputmode="numeric" list="code-list" data-f="code" data-i="${i}" value="${esc(r.code || '')}" aria-label="كود المادة للصف ${i + 1}" autocomplete="off">
        <span class="row-desc" dir="ltr" data-desc="${i}">${esc(it ? it.desc : r.doc_desc ? '(المستند) ' + r.doc_desc : '')}</span>
        <span class="sugg" data-sugg="${i}">${sugg.map((s) => `<button type="button" class="chip-btn" data-apply="${i}" data-code="${s}" title="${esc(C.describe(s))}">اقتراح: <span class="mono">${s}</span></button>`).join('')}</span></td>
      <td data-label="${KINDS[kind].qtyLabel}"><input class="input mono" dir="ltr" inputmode="decimal" data-f="qty" data-i="${i}" value="${r.qty == null ? '' : r.qty}" aria-label="${KINDS[kind].qtyLabel} للصف ${i + 1}">${hint != null ? `<small class="hint mono" dir="ltr">المطلوب: ${U.fmt(hint)}</small>` : ''}</td>
      ${cells}
      <td data-label="ملاحظات" class="rv-flags" data-flags="${i}">${flagsHtml(r)}</td>
      <td data-label="حذف"><button type="button" class="icon-btn icon-btn-danger" data-del-row="${i}" aria-label="احذف الصف ${i + 1}">${UI.icon('trash', 18)}</button></td>
    </tr>`;
  }

  function flagsHtml(r) {
    const f = (r.flags || []).filter((x) => x !== 'ai');
    const ex = kind !== 'gatepass' && r.code && existsKey(r) ? '<span class="flag flag-info">موجود في المشروع وسيُحدَّث</span>' : '';
    if (!f.length && !ex) return '<span class="flag flag-ok"><span aria-hidden="true">●</span> سليم</span>';
    return f.map((x) => {
      const lv = P.flagLevel([x]);
      return `<span class="flag flag-${lv}"><span aria-hidden="true">${FLAG_ICON[lv]}</span> ${esc(P.FLAG_TEXT[x] || x)}</span>`;
    }).join('') + ex;
  }

  function summaryHtml(d) {
    const bad = d.rows.filter((r) => P.flagLevel(r.flags) === 'bad').length;
    const warn = d.rows.filter((r) => P.flagLevel(r.flags) === 'warn').length;
    return `<span class="sum sum-all"><strong class="mono" dir="ltr">${d.rows.length}</strong> صف</span><span class="sum sum-bad"><strong class="mono" dir="ltr">${bad}</strong> يحتاج إدخالًا</span><span class="sum sum-warn"><strong class="mono" dir="ltr">${warn}</strong> للمراجعة</span><span class="sum sum-ok"><strong class="mono" dir="ltr">${d.rows.length - bad - warn}</strong> سليم</span>`;
  }

  function headerForm(d) {
    if (kind !== 'gatepass') return '';
    const h = d.header;
    const f = (k, label, type = 'text', extra = '') => `<label class="field"><span class="field-label">${label}</span><input class="input mono" dir="ltr" data-h="${k}" type="${type}" value="${esc(h[k] || '')}" ${extra}></label>`;
    return `<fieldset class="hdr-form"><legend class="h4">بيانات الـ Gate Pass</legend>
      ${f('no', 'رقم Gate Pass *', 'text', 'inputmode="numeric" required')}${f('date', 'التاريخ', 'date')}${f('erp_delivery', 'ERP Delivery', 'text', 'inputmode="numeric"')}${f('material_doc', 'Material Doc', 'text', 'inputmode="numeric"')}
      <label class="field field-wide"><span class="field-label">المقاول</span><input class="input" dir="ltr" data-h="contractor" value="${esc(h.contractor || '')}"></label>
    </fieldset>`;
  }

  function drawReview(host, d) {
    const k = KINDS[kind];
    const cols = {
      checklist: ['رقم الحجز', 'أمر العمل', 'البند'],
      uds: ['رقم المرجع', 'رقم الحجز'],
      gatepass: ['رقم الحجز', 'رقم السطر'],
    }[kind];
    const canMode = kind !== 'gatepass';
    host.innerHTML = `<section class="card wizard" aria-labelledby="wz-h">
      ${stepsBar(3)}
      <div class="rv-head"><h2 id="wz-h" class="h3">راجع ${k.title} واحفظها</h2><p class="muted">${esc(d.readInfo)} ${d.src && d.src !== 'excel' ? 'الصف الملوّن يحتاج تدخلك. لا يُحفظ أي صف ناقص الكود أو الكمية.' : ''}</p></div>
      ${d.warnings.length ? `<ul class="note note-warn">${d.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}
      <div class="rv-layout ${d.previewUrl ? 'has-img' : ''}">
        ${d.previewUrl ? `<aside class="rv-img"><button type="button" class="rv-img-btn" id="zoom" aria-label="كبّر صورة المستند">${`<img loading="lazy" decoding="async" src="${d.previewUrl}" alt="صورة المستند الأصلية للمقارنة مع الجدول">`}<span class="rv-zoom">${UI.icon('zoom', 18)}<span>كبّر الصورة</span></span></button></aside>` : ''}
        <div class="rv-main">
          ${headerForm(d)}
          <div class="rv-sum" id="rv-sum" role="status">${summaryHtml(d)}</div>
          <datalist id="code-list"></datalist>
          <div class="table-wrap"><table class="table review"><caption class="sr-only">جدول مراجعة ${k.title}</caption>
            <thead><tr><th scope="col">#</th><th scope="col">كود المادة</th><th scope="col">${k.qtyLabel}</th>${cols.map((c) => `<th scope="col">${c}</th>`).join('')}<th scope="col">ملاحظات</th><th scope="col"><span class="sr-only">حذف</span></th></tr></thead>
            <tbody id="rv-body">${d.rows.map(rowHtml).join('')}</tbody></table></div>
          ${d.rows.length ? '' : `<p class="muted">لا توجد صفوف. اضغط «أضف صفًا» لإدخال البيانات يدويًا.</p>`}
        </div>
      </div>
      <div class="rv-foot">
        ${canMode ? `<fieldset class="mode"><legend class="sr-only">طريقة الحفظ</legend><label class="radio"><input type="radio" name="mode" value="merge" ${d.mode === 'merge' ? 'checked' : ''}><span>ادمج مع الموجود</span></label><label class="radio"><input type="radio" name="mode" value="replace" ${d.mode === 'replace' ? 'checked' : ''}><span>استبدل القائمة الحالية</span></label></fieldset>` : ''}
        <label class="field field-note"><span class="field-label">${kind === 'gatepass' ? 'ملاحظة الصفحة' : 'رقم الصفحة أو ملاحظة'} (اختياري)</span><input class="input" id="note" value="${esc(d.note)}" placeholder="مثال: صفحة 3 من 12"></label>
        <div class="row-actions">
          <button type="button" class="btn" id="add-row">${UI.icon('plus', 20)}<span>أضف صفًا</span></button>
          <button type="button" class="btn" id="dl-draft">${UI.icon('sheet', 20)}<span>نزّل Excel للمسودة</span></button>
          <button type="button" class="btn btn-ghost" id="cancel">ألغِ المسودة</button>
          <button type="button" class="btn btn-primary" id="save">${UI.icon('check', 20)}<span>احفظ في المشروع</span></button>
        </div>
      </div>
    </section>`;
    bindReview(host, d);
  }

  function blank() {
    return { code: '', qty: null, flags: ['code_missing', 'qty_missing'], doc_desc: '' };
  }

  function bindReview(host, d) {
    const body = host.querySelector('#rv-body');
    const sum = host.querySelector('#rv-sum');
    const list = host.querySelector('#code-list');
    const refreshRow = (i) => {
      const tr = body.querySelector(`[data-row="${i}"]`);
      if (!tr) return;
      const r = d.rows[i];
      tr.className = `rv rv-${P.flagLevel(r.flags)}`;
      tr.querySelector(`[data-flags="${i}"]`).innerHTML = flagsHtml(r);
      const it = C.get(r.code);
      tr.querySelector(`[data-desc="${i}"]`).textContent = it ? it.desc : r.doc_desc ? '(المستند) ' + r.doc_desc : '';
      const sugg = [r.suggest, ...(r.suggestions || [])].filter(Boolean).filter((v, j, a) => a.indexOf(v) === j && v !== r.code);
      tr.querySelector(`[data-sugg="${i}"]`).innerHTML = sugg.map((s) => `<button type="button" class="chip-btn" data-apply="${i}" data-code="${s}" title="${esc(C.describe(s))}">اقتراح: <span class="mono">${s}</span></button>`).join('');
      sum.innerHTML = summaryHtml(d);
    };

    const onInput = U.debounce((e) => {
      const inp = e.target;
      if (inp.dataset.f === 'code') {
        const q = U.digits(inp.value).trim();
        list.innerHTML = C.search(q, 10).map((x) => `<option value="${x.code}">${esc(x.desc)}</option>`).join('');
      }
    }, 150);

    body.addEventListener('input', (e) => {
      const inp = e.target;
      const f = inp.dataset.f;
      if (!f) return;
      const i = Number(inp.dataset.i);
      const r = d.rows[i];
      const v = U.digits(inp.value).trim();
      if (f === 'qty') {
        r.qty = v === '' ? null : U.num(v);
        recheck(r, 'qty');
      } else {
        r[f] = f === 'reference' ? inp.value.trim() : v;
        if (f === 'code') {
          r.code = v.replace(/\D/g, '');
          recheck(r, 'code');
        } else if (f === 'reservation') recheck(r, 'reservation');
        if (f === 'work_order' && r.wo_type != null) r.unloading_point = r.work_order ? 'W' + r.work_order + (r.wo_type || '') + '/' + (r.item_no || '') : r.unloading_point;
      }
      refreshRow(i);
      onInput(e);
    });
    body.addEventListener('click', (e) => {
      const ap = e.target.closest('[data-apply]');
      if (ap) {
        const i = Number(ap.dataset.apply);
        d.rows[i].code = ap.dataset.code;
        d.rows[i].suggestions = [];
        recheck(d.rows[i], 'code');
        body.querySelector(`[data-f="code"][data-i="${i}"]`).value = ap.dataset.code;
        refreshRow(i);
        return;
      }
      const del = e.target.closest('[data-del-row]');
      if (del) {
        d.rows.splice(Number(del.dataset.delRow), 1);
        drawWizard();
      }
    });
    host.querySelectorAll('[data-h]').forEach((inp) =>
      inp.addEventListener('input', () => (d.header[inp.dataset.h] = U.digits(inp.value).trim() && inp.dataset.h !== 'contractor' ? U.digits(inp.value).trim() : inp.value.trim()))
    );
    const note = host.querySelector('#note');
    note.addEventListener('input', () => (d.note = note.value));
    host.querySelectorAll('[name="mode"]').forEach((r) => r.addEventListener('change', () => (d.mode = r.value)));
    const zoom = host.querySelector('#zoom');
    if (zoom)
      zoom.onclick = async () => {
        const big = d.doc ? await d.doc.firstImage(2200) : await UI.imageToBlob(d.blob, { maxSide: 2200, quality: 0.9, rotate: d.rotation });
        const url = URL.createObjectURL(big);
        UI.dialog({ title: 'صورة المستند', size: 'xl', body: `<img class="doc-img" loading="lazy" decoding="async" src="${url}" alt="صورة المستند الأصلي">`, actions: [{ label: 'إغلاق', value: null }] });
      };
    host.querySelector('#add-row').onclick = () => {
      d.rows.push(blank());
      drawWizard();
      const inputs = rootEl.querySelectorAll('[data-f="code"]');
      inputs[inputs.length - 1].focus();
    };
    host.querySelector('#cancel').onclick = async () => {
      if (d.rows.length && !(await UI.confirm('ستُحذف المسودة بما فيها من صفوف. هل تتابع؟', { ok: 'ألغِ المسودة', danger: true }))) return;
      if (d.previewUrl) URL.revokeObjectURL(d.previewUrl);
      releaseDoc(d);
      drafts[kind] = fresh();
      drawWizard();
    };
    host.querySelector('#dl-draft').onclick = () => downloadDraft(d);
    host.querySelector('#save').onclick = () => saveDraft(host, d);
  }

  function cleanRow(r) {
    const o = { ...r };
    ['flags', 'suggest', 'suggestions', 'y', 'group', 'gp_no', 'date'].forEach((k) => delete o[k]);
    o.qty = Number(o.qty);
    return o;
  }

  async function downloadDraft(d) {
    const rows = d.rows.filter((r) => r.code && Number.isFinite(r.qty));
    if (!rows.length) return UI.toast('لا توجد صفوف مكتملة لتصديرها.', { type: 'error' });
    const tmp = { checklist: [], uds: [], gatePasses: [] };
    if (kind === 'checklist') tmp.checklist = rows.map(cleanRow);
    else if (kind === 'uds') tmp.uds = rows.map(cleanRow);
    else tmp.gatePasses = [{ id: 'draft', no: d.header.no || 'بدون رقم', date: d.header.date, erp_delivery: d.header.erp_delivery, material_doc: d.header.material_doc, items: rows.map(cleanRow) }];
    const def = MT.Reports.sourceDefs(tmp)[kind];
    try {
      await MT.Excel.save([def], `${KINDS[kind].label.replace(' ', '')}-draft_${U.today()}`, { project: Store.project.name });
    } catch (e) {
      UI.toast(e.message, { type: 'error' });
    }
  }

  async function saveDraft(host, d) {
    const valid = d.rows.filter((r) => r.code && Number.isFinite(r.qty) && r.qty >= 0);
    const skipped = d.rows.length - valid.length;
    if (!valid.length) return UI.toast('لا توجد صفوف مكتملة. أكمل الكود والكمية.', { type: 'error' });
    if (kind === 'gatepass' && !(d.header.no || '').trim() && !valid.some((r) => r.gp_no)) {
      const inp = host.querySelector('[data-h="no"]');
      if (inp) inp.focus();
      return UI.toast('اكتب رقم الـ Gate Pass أولًا.', { type: 'error' });
    }
    if (skipped && !(await UI.confirm(`سيُتجاهل ${skipped} صف غير مكتمل (بدون كود أو كمية). هل تتابع بحفظ ${valid.length} صف؟`, { ok: 'احفظ المكتمل فقط' }))) return;
    if (kind !== 'gatepass' && d.mode === 'replace' && Store.data[kind].length && !(await UI.confirm(`ستُحذف كل بنود ${KINDS[kind].label} الحالية (${Store.data[kind].length} بند) التي ليست في هذه القائمة. هل تتابع؟`, { ok: 'استبدل القائمة', danger: true }))) return;
    const btn = host.querySelector('#save');
    btn.disabled = true;
    try {
      const imageBlob = d.src === 'image' && d.blob ? await UI.imageToBlob(d.blob, { maxSide: 1800, quality: 0.82, rotate: d.rotation }) : d.doc ? await d.doc.firstImage(1800) : null;
      let msg;
      if (kind === 'gatepass') {
        const groups = U.groupBy(valid, (r) => r.gp_no || d.header.no);
        let added = 0;
        let updated = 0;
        let merged = false;
        for (const [no, rows] of groups) {
          const date = (rows.find((r) => r.date) || {}).date || d.header.date;
          const res = await Store.importGatePass({ ...d.header, no, date, notes: d.note || d.header.notes }, rows.map(cleanRow), { imageBlob: groups.size === 1 ? imageBlob : null, pageNote: d.note });
          added += res.added;
          updated += res.updated;
          merged = merged || res.merged;
        }
        msg = `تم حفظ Gate Pass: ${added} بند جديد${updated ? `، ${updated} محدَّث` : ''}${merged ? ' (أُضيفت إلى مستند موجود)' : ''}.`;
      } else {
        const res = await Store.importList(kind, valid.map(cleanRow), { mode: d.mode, ref: d.note, note: d.src === 'excel' ? (d.file && d.file.name === 'الحافظة' ? 'من الحافظة' : 'من ملف Excel') : d.doc ? 'من ' + DOC_TYPES[d.doc.type] : d.src === 'image' ? 'من صورة' : 'إدخال يدوي', imageBlob });
        msg = `تم حفظ ${KINDS[kind].label}: ${res.added} بند جديد${res.updated ? `، ${res.updated} محدَّث` : ''}${res.removed ? `، ${res.removed} محذوف` : ''}.`;
      }
      if (d.previewUrl) URL.revokeObjectURL(d.previewUrl);
      releaseDoc(d);
      drafts[kind] = fresh();
      drawWizard();
      UI.toast(msg, { ms: 9000, action: { label: 'قارن الآن', fn: () => App.go('#/compare') } });
    } catch (e) {
      console.error(e);
      btn.disabled = false;
      UI.toast(e.message || String(e), { type: 'error', ms: 9000 });
    }
  }

  /* ====================== القوائم المحفوظة ====================== */
  function drawSaved() {
    const host = rootEl && rootEl.querySelector('#saved');
    if (!host) return;
    if (kind === 'gatepass') return drawSavedGp(host);
    const rows = Store.data[kind];
    const isCl = kind === 'checklist';
    host.innerHTML = `<section class="card panel panel-flush" aria-labelledby="sv-h">
      <div class="panel-head pad"><div><h2 id="sv-h" class="h3">بنود ${KINDS[kind].label} المحفوظة</h2><p class="muted">عدّل الكمية مباشرة في الجدول. يُحفظ التغيير فورًا.</p></div>
        <div class="panel-actions"><button class="btn btn-sm" type="button" id="sv-export" ${rows.length ? '' : 'disabled'}>${UI.icon('download', 16)}<span>نزّل Excel</span></button><button class="btn btn-sm btn-danger" type="button" id="sv-clear" ${rows.length ? '' : 'disabled'}>${UI.icon('trash', 16)}<span>امسح كل البنود</span></button></div></div>
      <div id="sv-table"></div></section>`;
    const columns = [
      { key: 'code', label: 'كود المادة', sort: (r) => r.code, render: (r) => UI.code(r.code) },
      { key: 'desc', label: 'الوصف', cls: 'col-desc', sort: (r) => C.describe(r.code), render: (r) => `<span class="desc" dir="ltr">${UI.descHtml(C.describe(r.code) || r.doc_desc || '—')}</span>` },
      { key: 'qty', label: isCl ? 'الكمية المطلوبة' : 'الكمية المسجلة', sort: (r) => r.qty, cls: 'num', render: (r) => `<input class="input input-qty mono" dir="ltr" inputmode="decimal" data-qty="${r.id}" value="${r.qty}" aria-label="الكمية للمادة ${r.code}">` },
    ].concat(
      isCl
        ? [
            { key: 'res', label: 'رقم الحجز', sort: (r) => r.reservation, render: (r) => `<span class="mono" dir="ltr">${esc(r.reservation || '—')}</span>` },
            { key: 'wo', label: 'أمر العمل', sort: (r) => r.work_order, render: (r) => `<span class="mono" dir="ltr">${esc(r.work_order || '—')}</span>` },
            { key: 'item', label: 'البند', sort: (r) => r.item_no, render: (r) => `<span class="mono" dir="ltr">${esc(r.item_no || '—')}</span>` },
          ]
        : [
            { key: 'ref', label: 'رقم المرجع', sort: (r) => r.reference, render: (r) => `<span class="mono" dir="ltr">${esc(r.reference || '—')}</span>` },
            { key: 'res', label: 'رقم الحجز', sort: (r) => r.reservation, render: (r) => `<span class="mono" dir="ltr">${esc(r.reservation || '—')}</span>` },
          ]
    );
    columns.push({ key: 'del', label: 'حذف', render: (r) => `<button type="button" class="icon-btn icon-btn-danger" data-del="${r.id}" aria-label="احذف بند ${r.code}">${UI.icon('trash', 18)}</button>` });
    const tbl = UI.dataTable(host.querySelector('#sv-table'), {
      caption: `بنود ${KINDS[kind].label} المحفوظة`,
      rows,
      pageSize: 10,
      sortKey: 'code',
      sortDir: 'asc',
      search: true,
      searchPlaceholder: 'ابحث في البنود المحفوظة',
      searchText: (r) => [r.code, C.describe(r.code), r.reservation, r.work_order, r.reference].join(' '),
      empty: UI.empty({ title: `لا توجد بنود ${KINDS[kind].label} بعد`, text: 'ابدأ من الأعلى بتصوير القائمة أو رفعها.' }),
      columns,
    });
    savedTables[kind] = tbl;
    host.querySelector('#sv-table').addEventListener('change', async (e) => {
      const inp = e.target.closest('[data-qty]');
      if (!inp) return;
      const v = U.num(inp.value);
      if (v == null || v < 0) {
        UI.toast('اكتب كمية صحيحة.', { type: 'error' });
        const row = Store.data[kind].find((x) => x.id === inp.dataset.qty);
        inp.value = row ? row.qty : '';
        return;
      }
      await Store.updateRow(kind, inp.dataset.qty, { qty: v });
      UI.toast('تم تحديث الكمية.', { ms: 1800 });
    });
    host.querySelector('#sv-table').addEventListener('click', async (e) => {
      const del = e.target.closest('[data-del]');
      if (!del) return;
      if (!(await UI.confirm('سيُحذف هذا البند من القائمة.', { ok: 'احذف البند', danger: true }))) return;
      await Store.deleteRows(kind, [del.dataset.del]);
    });
    host.querySelector('#sv-export').onclick = async () => {
      try {
        await MT.Excel.save([MT.Reports.sourceDefs(Store.data)[kind]], `${KINDS[kind].label.replace(' ', '')}_${U.today()}`, { project: Store.project.name });
        UI.toast('تم تنزيل ملف Excel.');
      } catch (e) {
        UI.toast(e.message, { type: 'error', ms: 8000 });
      }
    };
    host.querySelector('#sv-clear').onclick = async () => {
      if (!(await UI.confirm(`ستُحذف كل بنود ${KINDS[kind].label} (${rows.length} بند) من هذا المشروع.`, { ok: 'امسح الكل', danger: true }))) return;
      await Store.deleteRows(kind, rows.map((r) => r.id));
    };
  }

  function drawSavedGp(host) {
    const list = Store.data.gatePasses.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    host.innerHTML = `<section class="card panel" aria-labelledby="sv-h">
      <div class="panel-head"><div><h2 id="sv-h" class="h3">مستندات Gate Pass المحفوظة</h2><p class="muted">كل مستند يجمع صفحاته. عدّل الكمية مباشرة أو احذف بندًا.</p></div>
      <div class="panel-actions"><button class="btn btn-sm" type="button" id="sv-export" ${list.length ? '' : 'disabled'}>${UI.icon('download', 16)}<span>نزّل كل الـ Gate Pass Excel</span></button></div></div>
      ${list.length ? `<div class="gp-list">${list.map(gpCard).join('')}</div>` : UI.empty({ title: 'لا توجد مستندات Gate Pass بعد', text: 'صوّر أول صفحة من الـ Gate Pass من الأعلى.' })}</section>`;
    const sec = host.firstElementChild;
    host.querySelector('#sv-export').onclick = async () => {
      try {
        await MT.Excel.save([MT.Reports.sourceDefs(Store.data).gatepass], `GatePass-all_${U.today()}`, { project: Store.project.name });
        UI.toast('تم تنزيل ملف Excel.');
      } catch (e) {
        UI.toast(e.message, { type: 'error', ms: 8000 });
      }
    };
    sec.addEventListener('change', async (e) => {
      const inp = e.target.closest('[data-gp-qty]');
      if (!inp) return;
      const v = U.num(inp.value);
      const [gpId, itemId] = inp.dataset.gpQty.split(':');
      if (v == null || v < 0) {
        UI.toast('اكتب كمية صحيحة.', { type: 'error' });
        return;
      }
      await Store.updateGpItem(gpId, itemId, { qty: v });
      UI.toast('تم تحديث الكمية.', { ms: 1800 });
    });
    sec.addEventListener('click', async (e) => {
      const img = e.target.closest('[data-gp-img]');
      if (img) return MT.Views.showImage(img.dataset.gpImg);
      const di = e.target.closest('[data-gp-del-item]');
      if (di) {
        const [gpId, itemId] = di.dataset.gpDelItem.split(':');
        if (await UI.confirm('سيُحذف هذا البند من الـ Gate Pass.', { ok: 'احذف البند', danger: true })) await Store.deleteGpItem(gpId, itemId);
        return;
      }
      const eh = e.target.closest('[data-gp-edit]');
      if (eh) return editGpHeader(Store.data.gatePasses.find((p) => p.id === eh.dataset.gpEdit));
      const dg = e.target.closest('[data-gp-del]');
      if (dg) {
        const gp = Store.data.gatePasses.find((p) => p.id === dg.dataset.gpDel);
        if (await UI.confirm(`سيُحذف Gate Pass رقم ${gp.no} بكل بنوده (${gp.items.length}) وصوره.`, { ok: 'احذف المستند', danger: true })) await Store.deleteGatePass(gp.id);
        return;
      }
      const ex = e.target.closest('[data-gp-export]');
      if (ex) {
        const gp = Store.data.gatePasses.find((p) => p.id === ex.dataset.gpExport);
        try {
          await MT.Excel.save([MT.Reports.sourceDefs({ ...Store.data, gatePasses: [gp] }).gatepass], `GatePass_${gp.no}_${U.today()}`, { project: Store.project.name });
        } catch (er) {
          UI.toast(er.message, { type: 'error', ms: 8000 });
        }
      }
    });
  }

  async function editGpHeader(gp) {
    const f = (k, label, type = 'text') => `<label class="field"><span class="field-label">${label}</span><input class="input mono" dir="ltr" type="${type}" data-e="${k}" value="${esc(gp[k] || '')}"></label>`;
    let patch = null;
    await UI.dialog({
      title: `بيانات Gate Pass ${gp.no}`,
      size: 'sm',
      body: `${f('no', 'رقم Gate Pass')}${f('date', 'التاريخ', 'date')}${f('erp_delivery', 'ERP Delivery')}${f('material_doc', 'Material Doc')}${f('contractor', 'المقاول')}${f('notes', 'ملاحظات')}`,
      actions: [
        { label: 'إلغاء', value: false },
        {
          label: 'احفظ التعديل',
          kind: 'primary',
          noClose: true,
          onClick: (d) => {
            const v = Object.fromEntries([...d.querySelectorAll('[data-e]')].map((i) => [i.dataset.e, i.value.trim()]));
            if (!v.no) return UI.toast('رقم الـ Gate Pass مطلوب.', { type: 'error' });
            if (Store.data.gatePasses.some((p) => p.id !== gp.id && p.no === v.no)) return UI.toast('يوجد Gate Pass آخر بنفس الرقم. احذف أحدهما أو ادمجهما.', { type: 'error' });
            patch = { ...v, date: v.date || null };
            d.close('0');
          },
        },
      ],
    });
    if (patch) {
      try {
        await Store.updateGatePass(gp.id, patch);
        UI.toast('تم تعديل بيانات المستند.');
      } catch (e) {
        UI.toast(e.message, { type: 'error' });
      }
    }
  }

  function gpCard(gp) {
    const qty = U.sum(gp.items, (i) => i.qty);
    return `<details class="gp-card">
      <summary><span class="gp-no mono" dir="ltr">${esc(gp.no)}</span><span class="gp-meta"><span class="mono" dir="ltr">${U.fmtDate(gp.date)}</span><span>${gp.items.length} بند</span><span class="mono" dir="ltr">${U.fmt(qty)} قطعة</span>${(gp.images || []).length ? `<span>${gp.images.length} صورة</span>` : ''}</span></summary>
      <div class="gp-body">
        <p class="muted mono" dir="ltr">ERP ${esc(gp.erp_delivery || '—')}، Doc ${esc(gp.material_doc || '—')}، ${esc(gp.contractor || '')}</p>
        <div class="table-wrap"><table class="table table-sm"><caption class="sr-only">بنود Gate Pass ${esc(gp.no)}</caption>
          <thead><tr><th scope="col">كود المادة</th><th scope="col">الوصف</th><th scope="col">رقم الحجز</th><th scope="col">السطر</th><th scope="col">الكمية</th><th scope="col"><span class="sr-only">حذف</span></th></tr></thead>
          <tbody>${gp.items.map((i) => `<tr><td data-label="كود المادة">${UI.code(i.code)}</td><td data-label="الوصف" class="col-desc"><span class="desc" dir="ltr">${UI.descHtml(C.describe(i.code) || i.doc_desc || '—')}</span></td><td data-label="رقم الحجز"><span class="mono" dir="ltr">${esc(i.reservation || '—')}</span></td><td data-label="السطر"><span class="mono" dir="ltr">${esc(i.line_no || '—')}</span></td><td data-label="الكمية" class="num"><input class="input input-qty mono" dir="ltr" inputmode="decimal" data-gp-qty="${gp.id}:${i.id}" value="${i.qty}" aria-label="الكمية للمادة ${i.code}"></td><td data-label="حذف"><button type="button" class="icon-btn icon-btn-danger" data-gp-del-item="${gp.id}:${i.id}" aria-label="احذف بند ${i.code}">${UI.icon('trash', 18)}</button></td></tr>`).join('')}</tbody></table></div>
        <div class="row-actions">${(gp.images || []).map((r, n) => `<button type="button" class="btn btn-sm" data-gp-img="${esc(r)}">${UI.icon('image', 16)}<span>صورة ${n + 1}</span></button>`).join('')}<button type="button" class="btn btn-sm" data-gp-edit="${gp.id}">${UI.icon('edit', 16)}<span>عدّل بيانات المستند</span></button><button type="button" class="btn btn-sm" data-gp-export="${gp.id}">${UI.icon('download', 16)}<span>Excel لهذا المستند</span></button><button type="button" class="btn btn-sm btn-danger" data-gp-del="${gp.id}">${UI.icon('trash', 16)}<span>احذف المستند</span></button></div>
      </div></details>`;
  }

  /* Ctrl+V في أي مكان من شاشة الاستيراد (في خطوة اختيار المصدر فقط، ولا يتعارض مع حقول الإدخال) */
  document.addEventListener('paste', (e) => {
    if (!rootEl || !rootEl.isConnected) return;
    if (D(kind).step !== 'source') return;
    const t = e.target;
    if (t && t.closest && t.closest('input, textarea, select, [contenteditable="true"], dialog')) return;
    const cd = e.clipboardData;
    if (!cd) return;
    const files = [...cd.files];
    const text = cd.getData('text/plain');
    if (!files.length && !text.trim()) return;
    e.preventDefault();
    handlePasted({ files, text });
  });

  App.views.import = view;
})(window);
