/* قراءة ملفات Office الحديثة: عروض PowerPoint (pptx) ومستندات Word (docx).
   كلاهما أرشيف zip فيه XML: نستخرج النص والجداول بترتيب ظهورها، والصور الملصوقة (لقطات الشاشة).
   الصيغ القديمة (ppt وdoc) ملفات ثنائية مغلقة لا يمكن قراءتها داخل المتصفح. */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});

  const MAX_IMAGES = 12;
  const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp' };
  const lname = (n) => (n.localName || n.nodeName || '').replace(/^.*:/, '');
  const kids = (n) => Array.prototype.filter.call(n.childNodes || [], (c) => c.nodeType === 1);

  const parseXml = (text) => new g.DOMParser().parseFromString(text, 'application/xml');

  /** نص فقرة a:p: كل a:t مضافة، و a:br سطر جديد */
  function paraText(p) {
    let out = '';
    (function walk(n) {
      for (const c of kids(n)) {
        const t = lname(c);
        if (t === 't') out += c.textContent;
        else if (t === 'br') out += '\n';
        else if (t === 'fld' || t === 'r') walk(c);
      }
    })(p);
    return out.replace(/ /g, ' ');
  }

  /** مشي بترتيب المستند: النص بالأسطر، الجداول بصفوف، وصور a:blip */
  function walkShapes(node, out, relMap) {
    for (const c of kids(node)) {
      const t = lname(c);
      if (t === 'sp') {
        for (const body of kids(c).filter((x) => lname(x) === 'txBody')) {
          for (const p of kids(body).filter((x) => lname(x) === 'p')) {
            paraText(p)
              .split('\n')
              .map((x) => x.trim())
              .filter(Boolean)
              .forEach((x) => out.lines.push(x));
          }
        }
        // صورة كمالئة للشكل
        c.querySelectorAll('*').forEach((el) => {
          if (lname(el) === 'blip') addImage(el, out, relMap);
        });
      } else if (t === 'pic') {
        c.querySelectorAll('*').forEach((el) => {
          if (lname(el) === 'blip') addImage(el, out, relMap);
        });
      } else if (t === 'graphicFrame') {
        const tbl = Array.from(c.getElementsByTagName('*')).find((el) => lname(el) === 'tbl');
        if (tbl) {
          for (const tr of kids(tbl).filter((x) => lname(x) === 'tr')) {
            const cells = kids(tr)
              .filter((x) => lname(x) === 'tc')
              .map((tc) => kids(tc).filter((x) => lname(x) === 'txBody').map((b) => kids(b).filter((x) => lname(x) === 'p').map(paraText).join(' ')).join(' ').replace(/\s+/g, ' ').trim());
            const line = cells.filter(Boolean).join(' ');
            if (line) out.lines.push(line);
          }
        }
      } else if (t === 'grpSp' || t === 'spTree') {
        walkShapes(c, out, relMap);
      }
    }
  }

  function addImage(blip, out, relMap) {
    const id = blip.getAttribute('r:embed') || blip.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'embed');
    const target = id && relMap[id];
    if (target && !out.images.includes(target)) out.images.push(target);
  }

  function relsOf(xmlText) {
    const map = {};
    if (!xmlText) return map;
    for (const r of Array.from(parseXml(xmlText).getElementsByTagName('Relationship'))) map[r.getAttribute('Id')] = r.getAttribute('Target');
    return map;
  }

  /** يحوّل هدفًا نسبيًا مثل ../media/image1.png إلى مسار داخل الأرشيف */
  function resolve(base, target) {
    if (!target) return '';
    if (target.startsWith('/')) return target.slice(1);
    const parts = base.split('/').slice(0, -1);
    for (const seg of target.split('/')) {
      if (seg === '..') parts.pop();
      else if (seg !== '.') parts.push(seg);
    }
    return parts.join('/');
  }

  async function inspect(file) {
    if (/\.ppt$/i.test(file.name || '')) throw new Error('ملف PowerPoint القديم (ppt) لا يمكن قراءته هنا. افتحه واحفظه بصيغة pptx أو PDF ثم ارفعه.');
    const JSZip = await MT.Lib.load('jszip');
    let zip;
    try {
      zip = await JSZip.loadAsync(await file.arrayBuffer());
    } catch (e) {
      throw new Error('تعذّر فتح العرض. تأكد أنه ملف pptx سليم.');
    }
    const read = async (path) => (zip.file(path) ? zip.file(path).async('string') : '');

    // ترتيب الشرائح كما في العرض
    let slidePaths = [];
    const pres = await read('ppt/presentation.xml');
    if (pres) {
      const rels = relsOf(await read('ppt/_rels/presentation.xml.rels'));
      slidePaths = Array.from(parseXml(pres).getElementsByTagName('*'))
        .filter((n) => lname(n) === 'sldId')
        .map((n) => resolve('ppt/presentation.xml', rels[n.getAttribute('r:id')]))
        .filter((p) => zip.file(p));
    }
    if (!slidePaths.length) {
      slidePaths = Object.keys(zip.files)
        .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
        .sort((a, b) => parseInt(a.match(/(\d+)\.xml$/)[1], 10) - parseInt(b.match(/(\d+)\.xml$/)[1], 10));
    }
    if (!slidePaths.length) throw new Error('لم أجد شرائح في هذا الملف.');

    const lines = [];
    const images = [];
    let skipped = 0;
    let chars = 0;
    for (let i = 0; i < slidePaths.length; i++) {
      const path = slidePaths[i];
      const relPath = path.replace(/slides\/(slide\d+\.xml)$/, 'slides/_rels/$1.rels');
      const relMap = relsOf(await read(relPath));
      const out = { lines: [], images: [] };
      const doc = parseXml(await read(path));
      const tree = Array.from(doc.getElementsByTagName('*')).find((n) => lname(n) === 'spTree');
      if (tree) walkShapes(tree, out, relMap);
      out.lines.forEach((t) => {
        lines.push({ text: t, bbox: { x0: 0, y0: lines.length * 10, x1: 0, y1: lines.length * 10 + 9 }, confidence: 100, slide: i + 1 });
        chars += t.replace(/\s/g, '').length;
      });
      for (const target of out.images) {
        const p = resolve(path, target);
        const ext = (p.match(/\.([a-z0-9]+)$/i) || [])[1];
        const mime = ext && MIME[ext.toLowerCase()];
        if (!mime || !zip.file(p)) {
          skipped++;
          continue;
        }
        if (images.length >= MAX_IMAGES) continue;
        const bytes = await zip.file(p).async('uint8array');
        images.push({ blob: new Blob([bytes], { type: mime }), slide: i + 1, name: p.split('/').pop() });
      }
    }
    const hits = MT.OCR && MT.OCR.score ? MT.OCR.score(lines) : 0;
    return { slides: slidePaths.length, lines, chars, hits, textual: hits > 0 || chars >= 200, images, skipped, preview: images.length ? images[0].blob : null };
  }

  /* ---------- Word ---------- */
  function wordPara(p) {
    let out = '';
    (function walk(n) {
      for (const c of kids(n)) {
        const t = lname(c);
        if (t === 't') out += c.textContent;
        else if (t === 'tab') out += ' ';
        else if (t === 'br') out += '\n';
        else if (t === 'r' || t === 'hyperlink' || t === 'smartTag' || t === 'sdt' || t === 'sdtContent' || t === 'ins') walk(c);
      }
    })(p);
    return out.replace(/\u00a0/g, ' ');
  }

  function walkWord(node, out, relMap) {
    for (const c of kids(node)) {
      const t = lname(c);
      if (t === 'p') {
        wordPara(c)
          .split('\n')
          .map((x) => x.trim())
          .filter(Boolean)
          .forEach((x) => out.lines.push(x));
        c.querySelectorAll('*').forEach((el) => {
          if (lname(el) === 'blip') addImage(el, out, relMap);
        });
      } else if (t === 'tbl') {
        for (const tr of kids(c).filter((x) => lname(x) === 'tr')) {
          const cells = kids(tr)
            .filter((x) => lname(x) === 'tc')
            .map((tc) => kids(tc).filter((x) => lname(x) === 'p').map(wordPara).join(' ').replace(/\s+/g, ' ').trim());
          const line = cells.filter(Boolean).join(' ');
          if (line) out.lines.push(line);
        }
      } else if (t === 'body' || t === 'sdt' || t === 'sdtContent') {
        walkWord(c, out, relMap);
      }
    }
  }

  async function inspectDocx(file) {
    if (/\.doc$/i.test(file.name || '')) throw new Error('ملف Word القديم (doc) لا يمكن قراءته هنا. افتحه واحفظه بصيغة docx أو PDF ثم ارفعه.');
    const JSZip = await MT.Lib.load('jszip');
    let zip;
    try {
      zip = await JSZip.loadAsync(await file.arrayBuffer());
    } catch (e) {
      throw new Error('تعذّر فتح المستند. تأكد أنه ملف docx سليم.');
    }
    const read = async (path) => (zip.file(path) ? zip.file(path).async('string') : '');
    const xml = await read('word/document.xml');
    if (!xml) throw new Error('لم أجد محتوى في هذا الملف.');
    const relMap = relsOf(await read('word/_rels/document.xml.rels'));
    const out = { lines: [], images: [] };
    const body = Array.from(parseXml(xml).getElementsByTagName('*')).find((n) => lname(n) === 'body');
    if (body) walkWord(body, out, relMap);
    const lines = out.lines.map((t, i) => ({ text: t, bbox: { x0: 0, y0: i * 10, x1: 0, y1: i * 10 + 9 }, confidence: 100 }));
    const chars = out.lines.reduce((a, t) => a + t.replace(/\s/g, '').length, 0);
    const images = [];
    let skipped = 0;
    for (const target of out.images) {
      const p = resolve('word/document.xml', target);
      const ext = (p.match(/\.([a-z0-9]+)$/i) || [])[1];
      const mime = ext && MIME[ext.toLowerCase()];
      if (!mime || !zip.file(p)) {
        skipped++;
        continue;
      }
      if (images.length >= MAX_IMAGES) continue;
      images.push({ blob: new Blob([await zip.file(p).async('uint8array')], { type: mime }), slide: 1, name: p.split('/').pop() });
    }
    const hits = MT.OCR && MT.OCR.score ? MT.OCR.score(lines) : 0;
    return { slides: 1, lines, chars, hits, textual: hits > 0 || chars >= 200, images, skipped, preview: images.length ? images[0].blob : null };
  }

  MT.Office = { inspectPptx: inspect, inspectDocx, MAX_IMAGES };
  if (typeof module !== 'undefined' && module.exports) module.exports = MT.Office;
})(typeof window !== 'undefined' ? window : globalThis);
