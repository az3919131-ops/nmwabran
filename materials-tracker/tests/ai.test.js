/* القراءة الذكية: بناء الطلب، قراءة تيار SSE، المراجعة الثانية، ومعالجة الأخطاء (بدون شبكة حقيقية) */
const MT = require('./load');
const store = {};
globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => (store[k] = String(v)), removeItem: (k) => delete store[k] };
MT.UI = { imageToBlob: async (b) => b };
require('../assets/js/ai.js');
const AI = MT.AI;
AI._retry = [1, 1];

let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log('  ✗', m); } else console.log('  ✓', m); };

const sse = (json, { stop = 'end_turn', usage = { input_tokens: 1000, output_tokens: 500 } } = {}) => {
  const txt = JSON.stringify(json);
  const ev = (type, data) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
  const mid = Math.floor(txt.length / 2);
  return [
    ev('message_start', { message: { id: 'm', type: 'message', role: 'assistant', content: [], usage: { input_tokens: usage.input_tokens, output_tokens: 1 } } }),
    ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } }),
    ev('ping', {}),
    ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text: txt.slice(0, mid) } }),
    ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text: txt.slice(mid) } }),
    ev('content_block_stop', { index: 0 }),
    ev('message_delta', { delta: { stop_reason: stop }, usage: { output_tokens: usage.output_tokens } }),
    ev('message_stop', {}),
  ].join('');
};
const streamResponse = (body) => {
  const bytes = new TextEncoder().encode(body);
  const rs = new ReadableStream({ start(c) { for (let i = 0; i < bytes.length; i += 37) c.enqueue(bytes.slice(i, i + 37)); c.close(); } });
  return new Response(rs, { status: 200, headers: { 'content-type': 'text/event-stream' } });
};
const errResponse = (status, type, message) => new Response(JSON.stringify({ type: 'error', error: { type, message } }), { status, headers: { 'content-type': 'application/json' } });

const rows = (qtys) => qtys.map((q, i) => ({ material: '908121009', description: 'TERM KIT', uom: 'KIT', unloading_point: `W26405693980${i}/0005`, reservation: '003031598' + i, item_no: '0005', quantity: q }));
const doc = (qtys, sub) => ({ page: '1 of 1', rows: rows(qtys), subtotals: [{ material: '908121009', subtotal: sub }] });

(async () => {
  const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/jpeg' });
  const pdf = new Blob([new Uint8Array([37, 80, 68, 70])], { type: 'application/pdf' });

  console.log('== الطلب والاستجابة والمراجعة الثانية');
  AI.setKey('sk-ant-test');
  ok(AI.getModel() === 'claude-opus-5-5', 'النموذج الافتراضي Claude Opus 5.5');
  ok(AI.isEnabled(), 'القراءة الذكية مفعّلة افتراضيًا مع وجود مفتاح');
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    // أول طلب: الكميات 2+2+1 = 5 لكن المجموع المطبوع 6 فيُرسل للمراجعة. الثاني يصحح الكمية الأخيرة إلى 2
    return calls.length === 1 ? streamResponse(sse(doc([2, 2, 1], 6))) : streamResponse(sse({ rows: [{ index: 2, material: null, description: null, uom: null, unloading_point: null, reservation: null, item_no: null, quantity: 2 }] }));
  };
  const status = [];
  const out = await AI.read('checklist', [{ type: 'image', blob }, { type: 'pdf', blob: pdf }, { type: 'text', text: 'a\tb' }], { onStatus: (s) => status.push(s) });
  ok(calls.length === 2, 'طلبان: استخراج ثم مراجعة');
  const c1 = calls[0];
  ok(c1.url === 'https://api.anthropic.com/v1/messages', 'العنوان الصحيح');
  ok(c1.init.headers['x-api-key'] === 'sk-ant-test' && c1.init.headers['anthropic-version'] === '2026-10-21' && c1.init.headers['anthropic-dangerous-direct-browser-access'] === 'true', 'الترويسات المطلوبة للمتصفح');
  ok(c1.body.model === 'claude-opus-5-5' && c1.body.stream === true && c1.body.max_tokens >= 16000, 'النموذج والبث وحد الرموز');
  ok(c1.body.output_config.format.type === 'json_schema' && c1.body.output_config.effort === 'high', 'مخطط JSON ملزِم وجهد عالٍ');
  ok(!('temperature' in c1.body) && !('top_p' in c1.body) && !('top_k' in c1.body) && !('thinking' in c1.body) && !('tool_choice' in c1.body), 'لا معاملات ممنوعة على هذا النموذج');
  const types = c1.body.messages[0].content.map((x) => x.type);
  ok(types.join() === 'image,document,text,text', 'ترتيب الأجزاء: صورة، PDF، نص، ثم التعليمات: ' + types.join());
  ok(c1.body.messages[0].content[1].cache_control && !c1.body.messages[0].content[0].cache_control, 'تخزين مؤقت على آخر وسيط فقط');
  ok(c1.body.messages[0].content[1].source.media_type === 'application/pdf', 'PDF يُرسل كمستند');
  const noExtra = (s, path = '') => { let good = true; if (s && s.type === 'object') { good = s.additionalProperties === false && Object.keys(s.properties).every((k) => s.required.includes(k)); Object.values(s.properties).forEach((p) => (good = noExtra(p) && good)); } if (s && s.items) good = noExtra(s.items) && good; if (s && s.anyOf) s.anyOf.forEach((p) => (good = noExtra(p) && good)); return good; };
  ok(noExtra(c1.body.output_config.format.schema), 'المخطط: additionalProperties=false وكل الحقول مطلوبة');
  ok(out.verified === 3 && out.parsed.rows.length === 3 && out.parsed.rows[2].qty === 2, 'صُحّحت الكمية بعد المراجعة (1 إلى 2)، وأُرسلت 3 صفوف للمراجعة');
  ok(!out.parsed.rows.some((r) => r.flags.includes('sub_mismatch')), 'زال تنبيه المجموع الفرعي');
  ok(out.usage.input === 2000 && out.usage.output === 1000 && out.cost > 0, 'الاستهلاك والتكلفة: $' + out.cost.toFixed(4));
  ok(status.some((s) => /وصلت إلى/.test(s.text)) && status.some((s) => /مراجعة ثانية/.test(s.text)), 'رسائل التقدم أثناء البث والمراجعة');
  ok(calls[1].body.messages[0].content.slice(0, 3).every((x, i) => JSON.stringify(x) === JSON.stringify(c1.body.messages[0].content[i])), 'المراجعة تعيد نفس الوسائط (للاستفادة من الكاش)');

  console.log('== مراجعة تزيد الأخطاء لا تُقبل');
  calls.length = 0;
  globalThis.fetch = async (url, init) => { calls.push(1); return calls.length === 1 ? streamResponse(sse(doc([2, 2, 1], 6))) : streamResponse(sse({ rows: [{ index: 2, material: null, description: null, uom: null, unloading_point: null, reservation: null, item_no: null, quantity: 9 }] })); };
  const o2 = await AI.read('checklist', [{ type: 'image', blob }]);
  ok(o2.verified === 0 && o2.parsed.rows[2].qty === 1, 'مراجعة لا تقلل المشكلات تُهمل وتبقى القراءة الأولى: ' + o2.parsed.rows[2].qty);

  console.log('== الأخطاء');
  for (const [status, type, msg, code] of [[401, 'authentication_error', 'invalid x-api-key', 'auth'], [400, 'invalid_request_error', 'Your credit balance is too low to access the Anthropic API.', 'credit'], [413, 'request_too_large', 'x', 'too_big'], [404, 'not_found_error', 'model', 'model']]) {
    globalThis.fetch = async () => errResponse(status, type, msg);
    AI.setModel('claude-sonnet-5-5'); // لا مسار احتياطي لهذا النموذج
    const e = await AI.read('uds', [{ type: 'image', blob }]).catch((x) => x);
    ok(e && e.code === code && /[؀-ۿ]/.test(e.message), `${status} -> ${code}: ${e && e.message}`);
  }
  let n = 0;
  globalThis.fetch = async () => (++n < 3 ? errResponse(529, 'overloaded_error', 'Overloaded') : streamResponse(sse({ rows: [{ material: '908121008', description: 'X', quantity: 3, uom: 'KIT', reference: 'UDS-1', reservation: '0030312223' }] })));
  const o3 = await AI.read('uds', [{ type: 'image', blob }]);
  ok(n === 3 && o3.parsed.rows.length === 1 && o3.parsed.rows[0].qty === 3, 'إعادة المحاولة عند ازدحام الخدمة ثم النجاح');
  globalThis.fetch = async () => streamResponse(sse({ rows: [] }, { stop: 'refusal' }));
  ok((await AI.read('uds', [{ type: 'image', blob }]).catch((x) => x)).code === 'refusal', 'رفض المحتوى');
  globalThis.fetch = async () => streamResponse(sse({ rows: [] }, { stop: 'max_tokens' }));
  ok((await AI.read('uds', [{ type: 'image', blob }]).catch((x) => x)).code === 'too_long', 'الرد أطول من الحد');
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
  ok((await AI.read('uds', [{ type: 'image', blob }]).catch((x) => x)).code === 'network', 'انقطاع الشبكة');

  console.log('== مسار احتياطي للنموذج');
  AI.setModel('claude-opus-5-5');
  const models = [];
  globalThis.fetch = async (u, init) => { const b = JSON.parse(init.body); models.push(b.model); return b.model === 'claude-opus-5-5' ? errResponse(404, 'not_found_error', 'model: claude-opus-5-5') : streamResponse(sse({ rows: [] })); };
  const o4 = await AI.read('uds', [{ type: 'image', blob }]);
  ok(models.join() === 'claude-opus-5-5,claude-sonnet-5-5' && /غير متاح/.test(o4.parsed.warnings.join()), 'تحوّل إلى Sonnet مع تنبيه');

  console.log('== فحص المفتاح');
  let seen;
  globalThis.fetch = async (u, init) => { seen = u; return new Response('{"id":"claude-opus-5-5"}', { status: 200 }); };
  ok((await AI.test('sk-x', 'claude-opus-5-5')) === true && seen === 'https://api.anthropic.com/v1/models/claude-opus-5-5', 'الفحص بقراءة بيانات النموذج بلا تكلفة');
  AI.setKey('');
  ok(!AI.hasKey() && !AI.isEnabled(), 'بدون مفتاح لا تُفعّل');
  ok((await AI.read('uds', [{ type: 'image', blob }]).catch((x) => x)).code === 'nokey', 'القراءة بدون مفتاح ترفض برسالة');

  if (fail) { console.log('FAILED', fail); process.exit(1); }
  console.log('OK');
})();
