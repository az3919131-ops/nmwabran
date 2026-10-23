/* يختبر محوّل Supabase بعميل وهمي يحاكي PostgREST (الجداول، الربط مع materials، upsert، الحذف، التخزين، الدخول).
   لا يغني عن تجربة حقيقية على مشروع Supabase، لكنه يكشف أخطاء المنطق والتحويل. */
const MT = require('./load');
globalThis.MT_CONFIG = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'k', BUCKET: 'documents' };
const ls = new Map();
globalThis.localStorage = { getItem: (k) => (ls.has(k) ? ls.get(k) : null), setItem: (k, v) => ls.set(k, String(v)), removeItem: (k) => ls.delete(k) };
let uid = 0;
const newId = () => `00000000-0000-4000-8000-${String(++uid).padStart(12, '0')}`;

/* ---- عميل وهمي ---- */
const tables = { projects: [], materials: [], checklist_items: [], uds_records: [], gate_passes: [], gate_pass_items: [], activity_log: [] };
const storage = new Map();
let session = null;
const calls = [];
function builder(table) {
  const q = { op: 'select', filters: [], order: null, limit: null, single: false, sel: '*', payload: null, onConflict: 'id' };
  const api = {
    select(s) { q.sel = s || '*'; return api; },
    upsert(p, o) { q.op = 'upsert'; q.payload = [].concat(p); if (o && o.onConflict) q.onConflict = o.onConflict; return api; },
    insert(p) { q.op = 'insert'; q.payload = [].concat(p); return api; },
    delete() { q.op = 'delete'; return api; },
    eq(c, v) { q.filters.push((r) => r[c] === v); return api; },
    in(c, arr) { q.filters.push((r) => arr.includes(r[c])); return api; },
    order(c, o) { q.order = [c, !(o && o.ascending === false)]; return api; },
    limit(n) { q.limit = n; return api; },
    single() { q.single = true; return api; },
    then(res, rej) { return Promise.resolve(run()).then(res, rej); },
  };
  function embed(r) {
    const out = { ...r };
    if (/materials\(code\)/.test(q.sel) && r.material_id) { const m = tables.materials.find((x) => x.id === r.material_id); out.materials = m ? { code: m.code } : null; }
    if (/gate_pass_items\(/.test(q.sel)) out.gate_pass_items = tables.gate_pass_items.filter((i) => i.gate_pass_id === r.id).map((i) => ({ ...i, materials: { code: tables.materials.find((m) => m.id === i.material_id).code } }));
    return out;
  }
  function run() {
    calls.push(`${q.op} ${table}`);
    if (!session && table !== 'materials_public') return { data: null, error: { message: 'row-level security' } };
    const rows = tables[table];
    if (q.op === 'upsert' || q.op === 'insert') {
      const out = [];
      for (const p of q.payload) {
        for (const k of Object.keys(p)) if (p[k] === undefined) return { data: null, error: { message: 'undefined value for ' + k } };
        if (table === 'materials' && !p.code) return { data: null, error: { message: 'code required' } };
        const ex = q.op === 'upsert' ? rows.find((r) => r[q.onConflict] === p[q.onConflict] && p[q.onConflict] != null) : null;
        if (ex) { Object.assign(ex, p); out.push(ex); } else { const r = { id: newId(), created_at: new Date().toISOString(), ...p }; if (table === 'projects') r.created_by = session; rows.push(r); out.push(r); }
      }
      const data = /select/.test('') ? null : out.map(embed);
      return { data: q.single ? data[0] : data, error: null };
    }
    if (q.op === 'delete') {
      const keep = rows.filter((r) => !q.filters.every((f) => f(r)));
      const gone = rows.filter((r) => q.filters.every((f) => f(r)));
      tables[table] = keep;
      if (table === 'gate_passes') tables.gate_pass_items = tables.gate_pass_items.filter((i) => !gone.some((g) => g.id === i.gate_pass_id));
      if (table === 'projects') for (const t of ['checklist_items', 'uds_records', 'gate_passes', 'activity_log']) tables[t] = tables[t].filter((r) => !gone.some((g) => g.id === r.project_id));
      return { data: null, error: null };
    }
    let data = rows.filter((r) => q.filters.every((f) => f(r)));
    if (q.order) data = data.slice().sort((a, b) => (a[q.order[0]] > b[q.order[0]] ? 1 : -1) * (q.order[1] ? 1 : -1));
    if (q.limit) data = data.slice(0, q.limit);
    data = data.map(embed);
    return { data: q.single ? data[0] : data, error: null };
  }
  return api;
}
const fake = {
  from: builder,
  auth: {
    async getSession() { return { data: { session: session ? { user: { id: session, email: 'a@b.c', user_metadata: { name: 'أحمد' } } } : null } }; },
    async signInWithPassword({ email, password }) { if (password !== 'good') return { data: null, error: { message: 'Invalid login credentials' } }; session = 'user-1'; return { data: { user: { id: session, email, user_metadata: {} } }, error: null }; },
    async signUp() { return { data: { user: { id: 'u2', email: 'n@b.c' }, session: null }, error: null }; },
    async signOut() { session = null; },
  },
  storage: { from: () => ({
    async upload(path, blob) { storage.set(path, blob); return { error: null }; },
    async createSignedUrl(path) { return { data: { signedUrl: 'https://signed/' + path }, error: storage.has(path) ? null : { message: 'not found' } }; },
    async remove(paths) { paths.forEach((p) => storage.delete(p)); return { error: null }; },
  }) },
};
MT.Lib = { load: async () => {} };
globalThis.supabase = { createClient: () => fake };
require('../assets/js/store.js');
const { Store } = MT;

let fail = 0;
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) { fail++; console.log('  ✗', m, '\n    ', JSON.stringify(a), '\n    ', JSON.stringify(b)); } else console.log('  ✓', m); };

(async () => {
  eq(Store.mode, 'supabase', 'الوضع supabase عند وجود الإعدادات');
  await Store.init();
  eq(Store.user, null, 'لا جلسة قبل الدخول');
  let err = ''; try { await Store.signIn({ email: 'a@b.c', password: 'bad' }); } catch (e) { err = e.message; }
  eq(err, 'البريد الإلكتروني أو كلمة المرور غير صحيحة.', 'رسالة خطأ الدخول بالعربية');
  await Store.signIn({ email: 'a@b.c', password: 'good' });
  eq(Store.user.email, 'a@b.c', 'تسجيل الدخول');
  err = ''; try { await Store.signUp({ email: 'n@b.c', password: 'good12', name: 'x' }); } catch (e) { err = e.message; }
  eq(/تأكيد/.test(err), true, 'التسجيل يطلب تأكيد البريد');

  const p = await Store.addDemo();
  await Store.openProject(p.id);
  eq([Store.data.checklist.length, Store.data.uds.length, Store.data.gatePasses.length, Store.data.gatePasses[0].items.length, Store.data.activity.length], [13, 7, 1, 11, 3], 'المشروع التجريبي يُحفظ ويُقرأ كما هو');
  const r = MT.Compare.build(Store.data);
  eq(r.counts, { total: 7, ok: 3, short: 0, excess: 2, none: 2, udsDiff: 3, unknown: 0 }, 'نتيجة المقارنة بعد الرحلة عبر قاعدة البيانات');
  eq(tables.materials.length, 7, 'المواد تُنشأ عند أول استخدام فقط');
  eq(tables.materials.every((m) => m.in_catalog === true), true, 'مواد الكتالوج in_catalog = true');

  const x = await Store.importList('checklist', MT.Seed.CL.map(([code, reservation, item_no, qty, work_order, wo_type]) => ({ code, reservation, item_no, qty, work_order, wo_type })));
  eq([x.added, x.updated, tables.checklist_items.length], [0, 13, 13], 'إعادة الاستيراد لا تضاعف الصفوف في قاعدة البيانات');
  await Store.importList('uds', [{ code: '908199999', qty: 2, reference: 'Z' }]);
  eq(tables.materials.find((m) => m.code === '908199999').in_catalog, false, 'كود خارج الكتالوج in_catalog = false');

  const gpId = Store.data.gatePasses[0].id;
  const item = Store.data.gatePasses[0].items[0];
  await Store.updateGpItem(gpId, item.id, { qty: 9 });
  eq(tables.gate_pass_items.find((i) => i.id === item.id).issued_qty, 9, 'تعديل كمية بند Gate Pass');
  await Store.deleteGpItem(gpId, Store.data.gatePasses[0].items[1].id);
  eq(tables.gate_pass_items.length, 10, 'حذف بند Gate Pass من القاعدة');
  const res = await Store.importGatePass({ no: '2000538783', date: '2026-10-14' }, [{ line_no: '999', reservation: 'R', code: '908121150', qty: 1 }], { imageBlob: new Blob(['img']) });
  eq([res.merged, tables.gate_passes.length, tables.gate_pass_items.length], [true, 1, 11], 'صفحة ثانية تُضاف إلى نفس المستند');
  eq(Object.keys(Object.fromEntries(storage)).length, 1, 'الصورة رُفعت إلى التخزين');
  const gp = tables.gate_passes[0];
  eq(gp.image_paths.length, 1, 'مسار الصورة محفوظ في المستند');
  eq(await Store.imageUrl(gp.image_paths[0]), 'https://signed/' + gp.image_paths[0], 'رابط موقّع للصورة');

  await Store.openProject(p.id);
  eq(Store.data.gatePasses[0].items.length, 11, 'القراءة بعد التعديلات');
  await Store.deleteGatePass(gpId);
  eq([tables.gate_passes.length, tables.gate_pass_items.length], [0, 0], 'حذف Gate Pass يحذف بنوده');
  await Store.deleteProject(p.id);
  eq([tables.projects.length, tables.checklist_items.length, tables.uds_records.length], [0, 0, 0], 'حذف المشروع');

  await Store.signOut();
  err = ''; try { await Store.refreshProjects(); } catch (e) { err = e.message; }
  eq(/صلاحية/.test(err), true, 'بدون جلسة: رسالة صلاحيات بالعربية');
  if (fail) { console.log('FAILED', fail); process.exit(1); }
  console.log('OK');
})().catch((e) => { console.error(e); process.exit(1); });
