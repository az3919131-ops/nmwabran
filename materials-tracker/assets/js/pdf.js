/* قراءة ملفات PDF.
   إن كان في الملف نص مضمّن (تصدير من النظام) يُقرأ مباشرة بدقة كاملة.
   وإن كان صورة ممسوحة تُرسم صفحاته ثم تمر على قراءة الصور (OCR). */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});

  /* عرض مرجعي للصفحة يطابق مقياس قراءة الصور، فتبقى عتبات المحلل (قرب الأسطر) واحدة في الحالتين */
  const REF_W = 2400;
  const PAGE_GAP = 240;
  /* حد أعلى لعدد الصفحات المقروءة في الملف الواحد حتى لا تنفد ذاكرة الجوال */
  const MAX_PAGES = 12;
  /* خطوط وجداول ترميز يحمّلها pdf.js عند الحاجة فقط */
  const ASSETS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/';

  /**
   * يجمع قطع النص في أسطر.
   * items: [{ str, x, y, w, h, vertical }] بإحداثيات الصفحة (y يزيد نحو الأسفل، y هو خط الأساس).
   * يعيد أسطرًا بنفس شكل مخرجات OCR: { text, bbox: {x0,y0,x1,y1}, confidence }.
   */
  function groupItems(items) {
    const clean = items.filter((i) => i && typeof i.str === 'string' && i.str.trim() !== '');
    const rows = [];
    const side = [];
    for (const it of clean) {
      const h = Math.max(it.h || 0, 4);
      if (it.vertical) {
        side.push({ text: it.str.trim(), bbox: { x0: it.x, y0: it.y - it.w, x1: it.x + h, y1: it.y }, confidence: 100 });
        continue;
      }
      rows.push({ str: it.str, x: it.x, x1: it.x + (it.w || 0), y: it.y, h });
    }
    rows.sort((a, b) => a.y - b.y || a.x - b.x);
    const lines = [];
    for (const it of rows) {
      let line = null;
      for (let k = lines.length - 1; k >= 0 && k >= lines.length - 3; k--) {
        const L = lines[k];
        if (Math.abs(it.y - L.y) <= 0.45 * Math.max(it.h, L.h)) {
          line = L;
          break;
        }
      }
      if (!line) {
        line = { y: it.y, h: it.h, parts: [] };
        lines.push(line);
      }
      line.parts.push(it);
      line.h = Math.max(line.h, it.h);
    }
    const out = lines.map((L) => {
      L.parts.sort((a, b) => a.x - b.x);
      let text = '';
      let prev = null;
      for (const p of L.parts) {
        if (prev) {
          const gap = p.x - prev.x1;
          const spaced = /\s$/.test(prev.str) || /^\s/.test(p.str);
          if (!spaced && gap > 0.12 * L.h) text += ' ';
        }
        text += p.str;
        prev = p;
      }
      const x0 = Math.min(...L.parts.map((p) => p.x));
      const x1 = Math.max(...L.parts.map((p) => p.x1));
      const y1 = Math.max(...L.parts.map((p) => p.y));
      return { text: text.replace(/\s+/g, ' ').trim(), bbox: { x0, y0: y1 - L.h, x1, y1 }, confidence: 100 };
    });
    return out.concat(side).filter((l) => l.text);
  }

  async function open(file) {
    const lib = await MT.Lib.load('pdfjs');
    const w = MT.Lib.LIBS.pdfjs.worker;
    if (w && lib.GlobalWorkerOptions && !lib.GlobalWorkerOptions.workerSrc) lib.GlobalWorkerOptions.workerSrc = w;
    const data = new Uint8Array(await file.arrayBuffer());
    try {
      return await lib.getDocument({ data, standardFontDataUrl: ASSETS + 'standard_fonts/', cMapUrl: ASSETS + 'cmaps/', cMapPacked: true }).promise;
    } catch (e) {
      if (e && e.name === 'PasswordException') throw new Error('ملف PDF محمي بكلمة مرور. أزل الحماية ثم ارفعه من جديد.');
      if (e && (e.name === 'InvalidPDFException' || e.name === 'FormatError')) throw new Error('تعذّر فتح الملف. تأكد أنه PDF سليم.');
      throw new Error('تعذّر فتح ملف PDF: ' + ((e && e.message) || e));
    }
  }

  /** أسطر النص المضمّن لكل الصفحات المطلوبة، متتابعة رأسيًا بفاصل بين الصفحات */
  async function textLines(doc, pages) {
    const U = g.pdfjsLib.Util;
    const lines = [];
    let chars = 0;
    let offset = 0;
    for (let n = 1; n <= pages; n++) {
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const scale = REF_W / base.width;
      const vp = page.getViewport({ scale });
      const tc = await page.getTextContent();
      const items = [];
      for (const it of tc.items) {
        if (typeof it.str !== 'string' || !it.str.trim()) continue;
        const t = U.transform(vp.transform, it.transform);
        const vertical = Math.abs(t[1]) > Math.abs(t[0]) + 0.01;
        const h = Math.hypot(t[2], t[3]) || (it.height || 0) * scale;
        items.push({ str: it.str, x: t[4], y: t[5] + offset, w: (it.width || 0) * scale, h, vertical });
        chars += it.str.replace(/\s/g, '').length;
      }
      lines.push(...groupItems(items));
      offset += vp.height + PAGE_GAP;
      if (page.cleanup) page.cleanup();
    }
    return { lines, chars };
  }

  /** يرسم صفحة إلى Blob (JPEG) بالعرض المطلوب */
  async function renderPage(doc, n, width) {
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: Math.min(width / base.width, 4200 / base.height) });
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(vp.width));
    c.height = Math.max(1, Math.round(vp.height));
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    if (page.cleanup) page.cleanup();
    const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.92));
    c.width = c.height = 0;
    if (!blob) throw new Error('تعذّر تجهيز صفحة الملف.');
    return blob;
  }

  /** فحص أولي عند الرفع: عدد الصفحات، هل فيه نص مقروء، ومعاينة الصفحة الأولى */
  async function inspect(file) {
    const doc = await open(file);
    const used = Math.min(doc.numPages, MAX_PAGES);
    const { lines, chars } = await textLines(doc, used);
    const hits = MT.OCR && MT.OCR.score ? MT.OCR.score(lines) : 0;
    const textual = hits > 0 || chars >= 300;
    const preview = await renderPage(doc, 1, 1100);
    return { doc, pageCount: doc.numPages, usedPages: used, lines, chars, hits, textual, preview };
  }

  /** كل الصفحات المستخدمة كصور للقراءة الضوئية */
  async function renderAll(doc, pages, onStep) {
    const out = [];
    for (let n = 1; n <= pages; n++) {
      if (onStep) onStep(n, pages);
      out.push(await renderPage(doc, n, REF_W));
    }
    return out;
  }

  MT.PDF = { open, inspect, textLines, renderPage, renderAll, groupItems, MAX_PAGES, REF_W };
  if (typeof module !== 'undefined' && module.exports) module.exports = MT.PDF;
})(typeof window !== 'undefined' ? window : globalThis);
