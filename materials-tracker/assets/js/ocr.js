/* قراءة صور المستندات داخل المتصفح (Tesseract.js): اكتشاف اتجاه الصورة، تحسينها، ثم تحليل النص إلى صفوف. */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});
  const U = MT.Util;
  const P = MT.Parsers;

  const LANG_PATH = 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int';
  let workerPromise = null;
  let onProg = null;
  let idleTimer = null;

  const withTimeout = (promise, ms, msg) =>
    new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(msg)), ms);
      promise.then(
        (v) => (clearTimeout(t), resolve(v)),
        (e) => (clearTimeout(t), reject(e))
      );
    });

  async function getWorker() {
    const T = await MT.Lib.load('tesseract');
    if (!workerPromise) {
      let fail;
      const failed = new Promise((_, rej) => (fail = rej));
      const created = T.createWorker('eng', 1, {
        langPath: LANG_PATH,
        gzip: true,
        logger: (m) => onProg && onProg(m),
        errorHandler: (e) => fail(new Error('تعذّر تشغيل محرك القراءة: ' + ((e && e.message) || e))),
      });
      workerPromise = withTimeout(Promise.race([created, failed]), 120000, 'تعذّر تحميل محرك قراءة الصور. تأكد من الإنترنت ثم أعد المحاولة، أو أدخل البيانات يدويًا.').catch((e) => {
        workerPromise = null;
        throw e;
      });
    }
    return workerPromise;
  }

  function scheduleDispose() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(dispose, 120000);
  }
  async function dispose() {
    if (!workerPromise) return;
    const w = await workerPromise.catch(() => null);
    workerPromise = null;
    if (w) w.terminate();
  }

  /** يرسم الصورة مدوّرة بالحجم المطلوب ثم يحوّلها إلى تدرج رمادي مع مط التباين */
  async function prepareCanvas(blob, rotation, width) {
    const bmp = await MT.UI.loadBitmap(blob);
    const rot = ((rotation % 360) + 360) % 360;
    const swap = rot === 90 || rot === 270;
    const w0 = swap ? bmp.height : bmp.width;
    const h0 = swap ? bmp.width : bmp.height;
    const scale = Math.min(width / w0, 4200 / h0);
    const cw = Math.max(200, Math.round(w0 * scale));
    const ch = Math.max(200, Math.round(h0 * scale));
    const c = document.createElement('canvas');
    c.width = cw;
    c.height = ch;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, cw, ch);
    ctx.translate(cw / 2, ch / 2);
    ctx.rotate((rot * Math.PI) / 180);
    const dw = (swap ? ch : cw) ;
    const dh = (swap ? cw : ch);
    ctx.drawImage(bmp, -dw / 2, -dh / 2, dw, dh);
    if (bmp.close) bmp.close();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const img = ctx.getImageData(0, 0, cw, ch);
    const d = img.data;
    const hist = new Uint32Array(256);
    for (let i = 0; i < d.length; i += 4) {
      const y = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
      d[i] = y;
      hist[y | 0]++;
    }
    const total = cw * ch;
    let lo = 0;
    let hi = 255;
    let acc = 0;
    for (; lo < 255; lo++) {
      acc += hist[lo];
      if (acc > total * 0.01) break;
    }
    acc = 0;
    for (; hi > 0; hi--) {
      acc += hist[hi];
      if (acc > total * 0.01) break;
    }
    const span = Math.max(40, hi - lo);
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.max(0, Math.min(255, ((d[i] - lo) * 255) / span));
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  const RE_SCORE = [
    [/(?:^|\D)00\d{8}(?!\d)/g, 1],
    [/(?:^|\D)9081\d{5}(?!\d)/g, 1],
    [/W\s?\d{11,13}\s*[/\\]\s*\d{3,4}/gi, 2],
    [/gate\s*pass|reservation|unloading|material\s*desc|sub\s*total|erp\s*delivery/gi, 1],
  ];
  function score(lines) {
    const text = lines.map((l) => l.text).join('\n');
    let s = 0;
    for (const [re, w] of RE_SCORE) s += (text.match(re) || []).length * w;
    return s;
  }
  const toLines = (data) =>
    (data.lines || []).map((l) => ({ text: l.text, bbox: l.bbox, confidence: l.confidence })).filter((l) => l.text && l.text.trim());

  async function recognize(worker, canvas, psm) {
    await worker.setParameters({ tessedit_pageseg_mode: String(psm), user_defined_dpi: '300' });
    const { data } = await withTimeout(worker.recognize(canvas), 240000, 'استغرقت القراءة وقتًا طويلًا. جرّب صورة أصغر أو أعد المحاولة.');
    return { lines: toLines(data), text: data.text, confidence: data.confidence };
  }

  function candidates(w, h) {
    return w > h ? [270, 90, 0, 180] : [0, 180, 90, 270];
  }

  /**
   * يقرأ الصورة ويعيد { parsed, rotation, text }.
   * rotation: 'auto' أو عدد الدرجات (0/90/180/270).
   */
  async function read(kind, blob, { rotation = 'auto', onStatus, ctx = {} } = {}) {
    const say = (stage, pct, text) => onStatus && onStatus({ stage, pct, text });
    say('engine', 3, 'تحميل محرك القراءة (أول مرة فقط)...');
    onProg = (m) => {
      if (/loading/.test(m.status)) say('engine', 3 + Math.round(m.progress * 22), 'تحميل محرك القراءة (أول مرة فقط)...');
    };
    clearTimeout(idleTimer);
    const worker = await getWorker();

    let rot = rotation;
    if (rotation === 'auto') {
      const bmp = await MT.UI.loadBitmap(blob);
      const order = candidates(bmp.width, bmp.height);
      if (bmp.close) bmp.close();
      let best = { s: -1, r: 0 };
      for (let i = 0; i < order.length; i++) {
        say('orient', 25 + i * 6, 'فحص اتجاه الصورة...');
        const c = await prepareCanvas(blob, order[i], 1100);
        const res = await recognize(worker, c, 6);
        const s = score(res.lines);
        if (s > best.s) best = { s, r: order[i] };
        if (s >= 8) break;
      }
      rot = best.r;
    }

    onProg = (m) => {
      if (m.status === 'recognizing text') say('read', 50 + Math.round(m.progress * 40), 'قراءة النص من الصورة...');
    };
    say('read', 50, 'قراءة النص من الصورة...');
    const big = await prepareCanvas(blob, rot, 2400);
    const a = await recognize(worker, big, 6);
    let parsed;
    if (kind === 'checklist') {
      parsed = P.parseChecklist({ lines: a.lines }, ctx);
    } else if (kind === 'gatepass') {
      say('read', 80, 'تمريرة ثانية لتحسين الدقة...');
      const b = await recognize(worker, big, 4);
      parsed = P.mergeGatePass(P.parseGatePass({ lines: a.lines }, ctx), P.parseGatePass({ lines: b.lines }, ctx), ctx);
    } else {
      parsed = P.parseUds({ lines: a.lines }, ctx);
    }
    say('parse', 98, 'تحليل الصفوف...');
    scheduleDispose();
    return { parsed, rotation: rot, text: a.text, confidence: a.confidence, hits: score(a.lines) };
  }

  MT.OCR = { read, prepareCanvas, score, dispose };
  if (typeof module !== 'undefined' && module.exports) module.exports = MT.OCR;
})(typeof window !== 'undefined' ? window : globalThis);
