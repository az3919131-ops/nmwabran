/* طبقة التخزين: محوّل محلي (يعمل بفتح الملف) ومحوّل Supabase، وواجهة موحّدة فيها منطق الدمج ومنع التكرار. */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});
  const U = MT.Util;
  const C = MT.Catalog;
  const CFG = g.MT_CONFIG || {};

  const FIELDS = {
    checklist: ['id', 'code', 'qty', 'reservation', 'item_no', 'work_order', 'wo_type', 'unloading_point', 'doc_desc', 'uom', 'created_at'],
    uds: ['id', 'code', 'qty', 'reference', 'reservation', 'doc_desc', 'created_at'],
    gpItem: ['id', 'code', 'qty', 'reservation', 'line_no', 'uom', 'doc_desc'],
  };
  const pick = (o, keys) => keys.reduce((r, k) => ((r[k] = o[k] == null ? (k === 'qty' ? 0 : '') : o[k]), r), {});
  const KEYS = {
    checklist: (r) => [r.code, r.reservation || '', r.item_no || '', r.work_order || ''].join('|'),
    uds: (r) => [r.code, r.reference || '', r.reservation || ''].join('|'),
    gpItem: (r) => [r.reservation || '', r.code, r.line_no || ''].join('|'),
  };
  const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

  /* ======================= المحوّل المحلي ======================= */
  const Local = (() => {
    const KEY = 'mt:v1';
    const CAT_KEY = 'mt:catalog:v1';
    let db = { v: 1, user: null, projects: [], data: {} };
    let memoryOnly = false;
    let imgDb = null;

    function read() {
      try {
        const raw = g.localStorage.getItem(KEY);
        if (raw) db = Object.assign(db, JSON.parse(raw));
      } catch (e) {
        memoryOnly = true;
      }
    }
    function write() {
      if (memoryOnly) return;
      try {
        g.localStorage.setItem(KEY, JSON.stringify(db));
      } catch (e) {
        memoryOnly = true;
        MT.Store && MT.Store.emit('warn', 'تعذّر الحفظ في هذا المتصفح. البيانات ستبقى حتى تغلق الصفحة فقط.');
      }
    }
    const proj = (pid) => (db.data[pid] = db.data[pid] || { checklist: [], uds: [], gatePasses: [], activity: [] });

    const idb = () =>
      new Promise((resolve, reject) => {
        if (imgDb) return resolve(imgDb);
        if (!g.indexedDB) return reject(new Error('no-idb'));
        const req = g.indexedDB.open('mt-images', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('blobs');
        req.onsuccess = () => resolve((imgDb = req.result));
        req.onerror = () => reject(req.error);
      });
    const tx = async (mode, fn) => {
      const d = await idb();
      return new Promise((resolve, reject) => {
        const t = d.transaction('blobs', mode);
        const r = fn(t.objectStore('blobs'));
        t.oncomplete = () => resolve(r && r.result);
        t.onerror = () => reject(t.error);
      });
    };
    const urlCache = new Map();

    return {
      name: 'local',
      async init() {
        read();
      },
      auth: {
        async getUser() {
          return db.user;
        },
        async signIn({ name }) {
          db.user = { id: 'local', email: name || 'مستخدم محلي', name: name || 'مستخدم محلي' };
          write();
          return db.user;
        },
        async signOut() {
          db.user = null;
          write();
        },
      },
      projects: {
        async list() {
          return db.projects.slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
        },
        async upsert(p) {
          const i = db.projects.findIndex((x) => x.id === p.id);
          if (i >= 0) db.projects[i] = { ...db.projects[i], ...p };
          else db.projects.push(p);
          write();
          return p;
        },
        async remove(id) {
          db.projects = db.projects.filter((p) => p.id !== id);
          delete db.data[id];
          write();
        },
      },
      async loadProject(pid) {
        const d = proj(pid);
        return JSON.parse(JSON.stringify(d));
      },
      async saveRows(table, pid, rows) {
        const list = proj(pid)[table];
        rows.forEach((r) => {
          const i = list.findIndex((x) => x.id === r.id);
          if (i >= 0) list[i] = r;
          else list.push(r);
        });
        write();
      },
      async deleteRows(table, pid, ids) {
        const d = proj(pid);
        d[table] = d[table].filter((r) => !ids.includes(r.id));
        write();
      },
      async saveGatePass(pid, gp) {
        const list = proj(pid).gatePasses;
        const i = list.findIndex((x) => x.id === gp.id);
        const copy = JSON.parse(JSON.stringify(gp));
        if (i >= 0) list[i] = copy;
        else list.push(copy);
        write();
      },
      async deleteGatePass(pid, id) {
        const d = proj(pid);
        d.gatePasses = d.gatePasses.filter((x) => x.id !== id);
        write();
      },
      async addActivity(pid, e) {
        const a = proj(pid).activity;
        a.unshift(e);
        if (a.length > 500) a.length = 500;
        write();
      },
      async ensureMaterials() {},
      images: {
        async put(pid, kind, blob) {
          const ref = `${pid}/${kind}/${U.uid()}.jpg`;
          await tx('readwrite', (s) => s.put(blob, ref));
          return ref;
        },
        async url(ref) {
          if (urlCache.has(ref)) return urlCache.get(ref);
          const blob = await tx('readonly', (s) => s.get(ref));
          if (!blob) return null;
          const u = URL.createObjectURL(blob);
          urlCache.set(ref, u);
          return u;
        },
        async remove(ref) {
          try {
            await tx('readwrite', (s) => s.delete(ref));
          } catch (e) {
            /* لا شيء */
          }
        },
      },
      catalog: {
        async load() {
          try {
            return JSON.parse(g.localStorage.getItem(CAT_KEY) || '[]');
          } catch (e) {
            return [];
          }
        },
        async save(items) {
          try {
            const prev = JSON.parse(g.localStorage.getItem(CAT_KEY) || '[]');
            const map = new Map(prev.map((x) => [x[0], x]));
            items.forEach((x) => map.set(x[0], x));
            g.localStorage.setItem(CAT_KEY, JSON.stringify([...map.values()]));
          } catch (e) {
            throw new Error('تعذّر حفظ الكتالوج في هذا المتصفح');
          }
        },
      },
      exportAll: () => JSON.parse(JSON.stringify(db)),
      importAll(obj) {
        if (!obj || obj.v !== 1 || !Array.isArray(obj.projects)) throw new Error('ملف النسخة الاحتياطية غير صالح');
        const user = db.user;
        db = { v: 1, user, projects: obj.projects, data: obj.data || {} };
        write();
      },
    };
  })();

  /* ======================= محوّل Supabase ======================= */
  const Sb = (() => {
    let client = null;
    const matIds = new Map();
    const BUCKET = CFG.BUCKET || 'documents';
    const fail = (error) => {
      if (error) throw new Error(translateError(error));
    };
    function translateError(e) {
      const m = String((e && e.message) || e);
      if (/Invalid login credentials/i.test(m)) return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
      if (/Email not confirmed/i.test(m)) return 'لم يتم تأكيد البريد الإلكتروني بعد. افتح رسالة التأكيد أولًا.';
      if (/signups? (are )?not allowed|Signups not allowed/i.test(m)) return 'إنشاء الحسابات مغلق. اطلب من مدير المشروع إضافة حسابك.';
      if (/row-level security|permission denied/i.test(m)) return 'ليس لديك صلاحية لهذه العملية. تأكد من تسجيل الدخول ومن تشغيل ملف schema.sql.';
      if (/relation .* does not exist|Could not find the table/i.test(m)) return 'جداول قاعدة البيانات غير موجودة. شغّل ملف supabase/schema.sql من لوحة Supabase.';
      if (/Failed to fetch|NetworkError/i.test(m)) return 'تعذّر الاتصال بالإنترنت.';
      return m;
    }
    const mapUser = (u) => ({ id: u.id, email: u.email, name: (u.user_metadata && u.user_metadata.name) || u.email });

    async function ensureMaterials(list) {
      const todo = list.filter((m) => m.code && !matIds.has(m.code));
      const uniq = [...new Map(todo.map((m) => [m.code, m])).values()];
      for (const part of chunk(uniq, 200)) {
        const rows = part.map((m) => ({ code: m.code, description: m.description || '', unit: m.unit || '', category: m.category || '', in_catalog: !!m.in_catalog }));
        const { data, error } = await client.from('materials').upsert(rows, { onConflict: 'code' }).select('id,code');
        fail(error);
        data.forEach((r) => matIds.set(r.code, r.id));
      }
    }
    const matInfo = (code, doc) => {
      const it = C.get(code);
      return { code, description: (it && it.desc) || doc || '', unit: (it && it.unit) || '', category: (it && it.category) || '', in_catalog: !!(it && it.source === 'catalog') };
    };
    const codeOf = (row) => (row.materials && row.materials.code) || '';

    const toDb = {
      checklist: (pid, r) => ({ id: r.id, project_id: pid, material_id: matIds.get(r.code), required_qty: r.qty, reservation_no: r.reservation || null, item_no: r.item_no || null, work_order: r.work_order || null, wo_type: r.wo_type || null, unloading_point: r.unloading_point || null, doc_desc: r.doc_desc || null, uom: r.uom || null }),
      uds: (pid, r) => ({ id: r.id, project_id: pid, material_id: matIds.get(r.code), registered_qty: r.qty, reference_no: r.reference || null, reservation_no: r.reservation || null, doc_desc: r.doc_desc || null }),
    };
    const TABLES = { checklist: 'checklist_items', uds: 'uds_records' };

    return {
      name: 'supabase',
      async init() {
        await MT.Lib.load('supabase');
        client = g.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
      },
      auth: {
        async getUser() {
          const { data } = await client.auth.getSession();
          return data && data.session ? mapUser(data.session.user) : null;
        },
        async signIn({ email, password }) {
          const { data, error } = await client.auth.signInWithPassword({ email, password });
          fail(error);
          return mapUser(data.user);
        },
        async signUp({ email, password, name }) {
          const { data, error } = await client.auth.signUp({ email, password, options: { data: { name } } });
          fail(error);
          if (!data.session) throw new Error('تم إنشاء الحساب. افتح رسالة التأكيد في بريدك ثم سجّل الدخول.');
          return mapUser(data.user);
        },
        async signOut() {
          await client.auth.signOut();
        },
      },
      projects: {
        async list() {
          const { data, error } = await client.from('projects').select('*').order('created_at', { ascending: false });
          fail(error);
          return data;
        },
        async upsert(p) {
          const row = { id: p.id, name: p.name, region: p.region || null, contractor: p.contractor || null, notes: p.notes || null };
          const { data, error } = await client.from('projects').upsert(row).select().single();
          fail(error);
          return data;
        },
        async remove(id) {
          const { error } = await client.from('projects').delete().eq('id', id);
          fail(error);
        },
      },
      async loadProject(pid) {
        const q = (t, sel) => client.from(t).select(sel).eq('project_id', pid);
        const [cl, uds, gps, act] = await Promise.all([
          q('checklist_items', '*, materials(code)').order('created_at'),
          q('uds_records', '*, materials(code)').order('created_at'),
          q('gate_passes', '*, gate_pass_items(*, materials(code))').order('issue_date', { ascending: true }),
          q('activity_log', '*').order('created_at', { ascending: false }).limit(300),
        ]);
        [cl, uds, gps, act].forEach((r) => fail(r.error));
        return {
          checklist: cl.data.map((r) => ({ id: r.id, code: codeOf(r), qty: Number(r.required_qty), reservation: r.reservation_no || '', item_no: r.item_no || '', work_order: r.work_order || '', wo_type: r.wo_type || '', unloading_point: r.unloading_point || '', doc_desc: r.doc_desc || '', uom: r.uom || '', created_at: r.created_at })),
          uds: uds.data.map((r) => ({ id: r.id, code: codeOf(r), qty: Number(r.registered_qty), reference: r.reference_no || '', reservation: r.reservation_no || '', doc_desc: r.doc_desc || '', created_at: r.created_at })),
          gatePasses: gps.data.map((p) => ({
            id: p.id,
            no: p.gate_pass_no,
            date: p.issue_date,
            erp_delivery: p.erp_delivery || '',
            material_doc: p.material_doc || '',
            plant: p.plant || '',
            storage: p.storage_location || '',
            contractor: p.contractor || '',
            notes: p.notes || '',
            images: p.image_paths || [],
            created_at: p.created_at,
            items: (p.gate_pass_items || []).map((i) => ({ id: i.id, code: codeOf(i), qty: Number(i.issued_qty), reservation: i.reservation_no || '', line_no: i.line_no || '', uom: i.uom || '', doc_desc: i.doc_desc || '' })),
          })),
          activity: act.data.map((a) => ({ id: a.id, at: a.created_at, kind: a.kind, ref: a.ref || '', count: a.items_count || 0, user: a.user_email || '', note: a.note || '', image: a.image_path || '' })),
        };
      },
      async saveRows(table, pid, rows) {
        await ensureMaterials(rows.map((r) => matInfo(r.code, r.doc_desc)));
        for (const part of chunk(rows, 200)) {
          const { error } = await client.from(TABLES[table]).upsert(part.map((r) => toDb[table](pid, r)), { onConflict: 'id' });
          fail(error);
        }
      },
      async deleteRows(table, pid, ids) {
        for (const part of chunk(ids, 100)) {
          const { error } = await client.from(TABLES[table]).delete().in('id', part);
          fail(error);
        }
      },
      async saveGatePass(pid, gp) {
        await ensureMaterials(gp.items.map((i) => matInfo(i.code, i.doc_desc)));
        const head = { id: gp.id, project_id: pid, gate_pass_no: gp.no, issue_date: gp.date || null, image_paths: gp.images || [], notes: gp.notes || null, erp_delivery: gp.erp_delivery || null, material_doc: gp.material_doc || null, plant: gp.plant || null, storage_location: gp.storage || null, contractor: gp.contractor || null };
        let r = await client.from('gate_passes').upsert(head, { onConflict: 'id' });
        fail(r.error);
        const items = gp.items.map((i) => ({ id: i.id, gate_pass_id: gp.id, material_id: matIds.get(i.code), issued_qty: i.qty, reservation_no: i.reservation || null, line_no: i.line_no || null, uom: i.uom || null, doc_desc: i.doc_desc || null }));
        for (const part of chunk(items, 200)) {
          r = await client.from('gate_pass_items').upsert(part, { onConflict: 'id' });
          fail(r.error);
        }
        // حذف البنود التي أُزيلت من الواجهة
        const keep = gp.items.map((i) => i.id);
        const { data: existing, error } = await client.from('gate_pass_items').select('id').eq('gate_pass_id', gp.id);
        fail(error);
        const gone = existing.map((x) => x.id).filter((id) => !keep.includes(id));
        if (gone.length) fail((await client.from('gate_pass_items').delete().in('id', gone)).error);
      },
      async deleteGatePass(pid, id) {
        fail((await client.from('gate_passes').delete().eq('id', id)).error);
      },
      async addActivity(pid, e) {
        fail((await client.from('activity_log').insert({ id: e.id, project_id: pid, kind: e.kind, ref: e.ref, items_count: e.count, note: e.note || null, image_path: e.image || null, user_email: e.user })).error);
      },
      ensureMaterials,
      images: {
        async put(pid, kind, blob) {
          const path = `${pid}/${kind}/${U.uid()}.jpg`;
          const { error } = await client.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false });
          fail(error);
          return path;
        },
        async url(ref) {
          const { data, error } = await client.storage.from(BUCKET).createSignedUrl(ref, 3600);
          fail(error);
          return data.signedUrl;
        },
        async remove(ref) {
          await client.storage.from(BUCKET).remove([ref]);
        },
      },
      catalog: {
        async load() {
          const { data, error } = await client.from('materials').select('code,description,unit,category').eq('in_catalog', true).limit(10000);
          fail(error);
          return data.map((m) => [m.code, m.description || '', m.unit || '', -1, m.category || '']);
        },
        async save(items) {
          await ensureMaterials(items.map((m) => ({ code: m[0], description: m[1], unit: m[2], category: m[4] || '', in_catalog: true })));
        },
      },
      translateError,
    };
  })();

  /* ======================= الواجهة الموحّدة ======================= */
  const listeners = {};
  const Store = {
    mode: CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY ? 'supabase' : 'local',
    adapter: null,
    user: null,
    projects: [],
    project: null,
    data: null,

    on(evt, fn) {
      (listeners[evt] = listeners[evt] || []).push(fn);
    },
    emit(evt, payload) {
      (listeners[evt] || []).forEach((fn) => fn(payload));
    },

    async init() {
      this.adapter = this.mode === 'supabase' ? Sb : Local;
      await this.adapter.init();
      this.user = await this.adapter.auth.getUser();
      try {
        const extra = await this.adapter.catalog.load();
        if (extra.length) C.merge(extra);
      } catch (e) {
        /* الكتالوج المدمج يكفي */
      }
      return this.user;
    },
    async signIn(creds) {
      this.user = await this.adapter.auth.signIn(creds);
      return this.user;
    },
    async signUp(creds) {
      this.user = await this.adapter.auth.signUp(creds);
      return this.user;
    },
    async signOut() {
      await this.adapter.auth.signOut();
      this.user = null;
      this.project = null;
      this.data = null;
    },

    /* ----- المشاريع ----- */
    async refreshProjects() {
      this.projects = await this.adapter.projects.list();
      return this.projects;
    },
    async createProject({ name, region, contractor }) {
      const p = { id: U.uid(), name: name.trim(), region: (region || 'نجران').trim(), contractor: (contractor || '').trim(), created_at: new Date().toISOString() };
      const saved = await this.adapter.projects.upsert(p);
      await this.refreshProjects();
      return saved;
    },
    async deleteProject(id) {
      await this.adapter.projects.remove(id);
      if (this.project && this.project.id === id) {
        this.project = null;
        this.data = null;
      }
      await this.refreshProjects();
    },
    async addDemo() {
      const { project, data } = MT.Seed.demo(this.user && this.user.email);
      await this.adapter.projects.upsert(project);
      await this.adapter.saveRows('checklist', project.id, data.checklist);
      await this.adapter.saveRows('uds', project.id, data.uds);
      for (const gp of data.gatePasses) await this.adapter.saveGatePass(project.id, gp);
      for (const a of data.activity.slice().reverse()) await this.adapter.addActivity(project.id, a);
      await this.refreshProjects();
      return project;
    },
    async openProject(id) {
      const p = this.projects.find((x) => x.id === id) || (await this.refreshProjects()).find((x) => x.id === id);
      if (!p) throw new Error('المشروع غير موجود');
      const data = await this.adapter.loadProject(id);
      data.gatePasses.forEach((gp) => (gp.items = gp.items || []));
      this.project = p;
      this.data = data;
      this.registerUnknownCodes();
      try {
        g.localStorage.setItem('mt:last-project', id);
      } catch (e) {
        /* اختياري */
      }
      this.emit('project');
      return p;
    },
    /** بيانات كل المشاريع (لصفحة الإجمالي) دون تغيير المشروع المفتوح */
    async loadAllProjects() {
      const list = await this.refreshProjects();
      const out = [];
      for (const p of list) {
        const data = this.project && this.project.id === p.id && this.data ? this.data : await this.adapter.loadProject(p.id);
        data.gatePasses.forEach((gp) => (gp.items = gp.items || []));
        this.registerUnknownCodes(data);
        out.push({ project: p, data });
      }
      return out;
    },
    registerUnknownCodes(data = this.data) {
      const all = [...data.checklist, ...data.uds, ...data.gatePasses.flatMap((p) => p.items)];
      all.forEach((r) => r.code && !C.get(r.code) && C.addExtra(r.code, r.doc_desc, r.uom));
    },
    lastProjectId() {
      try {
        return g.localStorage.getItem('mt:last-project');
      } catch (e) {
        return null;
      }
    },

    /* ----- الدمج ومنع التكرار ----- */
    _merge(kind, existing, incoming, mode) {
      const keyFn = KEYS[kind];
      const fields = FIELDS[kind];
      const byKey = U.groupBy(existing, keyFn);
      const used = new Set();
      const save = [];
      let added = 0;
      let updated = 0;
      for (const row of incoming) {
        const clean = pick(row, fields);
        const pool = byKey.get(keyFn(clean)) || [];
        const hit = pool.find((x) => !used.has(x.id));
        if (hit) {
          used.add(hit.id);
          save.push({ ...hit, ...clean, id: hit.id, created_at: hit.created_at });
          updated++;
        } else {
          save.push({ ...clean, id: U.uid(), created_at: new Date().toISOString() });
          added++;
        }
      }
      const removed = mode === 'replace' ? existing.filter((x) => !used.has(x.id)).map((x) => x.id) : [];
      return { save, added, updated, removed };
    },

    async _log(kind, ref, count, note, image) {
      const e = { id: U.uid(), at: new Date().toISOString(), kind, ref: ref || '', count: count || 0, user: (this.user && (this.user.name || this.user.email)) || '', note: note || '', image: image || '' };
      await this.adapter.addActivity(this.project.id, e);
      this.data.activity.unshift(e);
      return e;
    },

    async _ensureCatalog(rows) {
      const unknown = rows.filter((r) => r.code && !C.get(r.code));
      unknown.forEach((r) => C.addExtra(r.code, r.doc_desc, r.uom));
    },

    async uploadImage(kind, blob) {
      return this.adapter.images.put(this.project.id, kind, blob);
    },
    imageUrl(ref) {
      return this.adapter.images.url(ref);
    },

    async importList(kind, rows, { mode = 'merge', note = '', ref = '', imageBlob = null } = {}) {
      const table = kind;
      const existing = this.data[table];
      const m = this._merge(kind, existing, rows, mode);
      await this._ensureCatalog(m.save);
      if (m.save.length) await this.adapter.saveRows(table, this.project.id, m.save);
      if (m.removed.length) await this.adapter.deleteRows(table, this.project.id, m.removed);
      const byId = new Map(m.save.map((r) => [r.id, r]));
      this.data[table] = existing.filter((r) => !m.removed.includes(r.id)).map((r) => byId.get(r.id) || r).concat(m.save.filter((r) => !existing.some((x) => x.id === r.id)));
      const image = imageBlob ? await this.uploadImage(kind, imageBlob).catch(() => '') : '';
      await this._log(kind, ref, m.save.length, `${m.added} جديد، ${m.updated} محدَّث${m.removed.length ? `، ${m.removed.length} محذوف` : ''}${note ? '، ' + note : ''}`, image);
      this.emit('change');
      return { added: m.added, updated: m.updated, removed: m.removed.length };
    },

    async importGatePass(header, rows, { imageBlob = null, pageNote = '' } = {}) {
      const no = String(header.no || '').trim();
      if (!no) throw new Error('رقم الـ Gate Pass مطلوب');
      let gp = this.data.gatePasses.find((p) => p.no === no);
      const merged = !!gp;
      if (!gp) {
        gp = { id: U.uid(), no, date: null, erp_delivery: '', material_doc: '', plant: '', storage: '', contractor: '', notes: '', images: [], created_at: new Date().toISOString(), items: [] };
      }
      ['date', 'erp_delivery', 'material_doc', 'plant', 'storage', 'contractor'].forEach((k) => {
        if (header[k]) gp[k] = header[k];
      });
      if (header.notes) gp.notes = header.notes;
      const m = this._merge('gpItem', gp.items, rows, 'merge');
      await this._ensureCatalog(m.save);
      const byId = new Map(m.save.map((r) => [r.id, r]));
      gp.items = gp.items.map((r) => byId.get(r.id) || r).concat(m.save.filter((r) => !gp.items.some((x) => x.id === r.id)));
      let image = '';
      if (imageBlob) {
        image = await this.uploadImage('gatepass', imageBlob).catch(() => '');
        if (image) gp.images = [...(gp.images || []), image];
      }
      await this.adapter.saveGatePass(this.project.id, gp);
      if (!merged) this.data.gatePasses.push(gp);
      await this._log('gatepass', no, m.save.length, `${merged ? 'أُضيفت صفحة إلى Gate Pass موجود' : 'Gate Pass جديد'}، ${m.added} جديد، ${m.updated} محدَّث${pageNote ? '، ' + pageNote : ''}`, image);
      this.emit('change');
      return { added: m.added, updated: m.updated, merged, gp };
    },

    /* ----- تعديل وحذف ----- */
    async updateRow(kind, id, patch) {
      const row = this.data[kind].find((r) => r.id === id);
      if (!row) return;
      Object.assign(row, patch);
      await this.adapter.saveRows(kind, this.project.id, [row]);
      this.emit('change');
    },
    async deleteRows(kind, ids) {
      await this.adapter.deleteRows(kind, this.project.id, ids);
      this.data[kind] = this.data[kind].filter((r) => !ids.includes(r.id));
      await this._log(kind, '', ids.length, 'حذف بنود');
      this.emit('change');
    },
    async updateGpItem(gpId, itemId, patch) {
      const gp = this.data.gatePasses.find((p) => p.id === gpId);
      const it = gp && gp.items.find((i) => i.id === itemId);
      if (!it) return;
      Object.assign(it, patch);
      await this.adapter.saveGatePass(this.project.id, gp);
      this.emit('change');
    },
    async updateGatePass(id, patch) {
      const gp = this.data.gatePasses.find((p) => p.id === id);
      if (!gp) return;
      const old = gp.no;
      ['no', 'date', 'erp_delivery', 'material_doc', 'contractor', 'notes'].forEach((k) => {
        if (patch[k] !== undefined) gp[k] = patch[k];
      });
      await this.adapter.saveGatePass(this.project.id, gp);
      await this._log('gatepass', gp.no, 0, old !== gp.no ? `تعديل رقم Gate Pass من ${old}` : 'تعديل بيانات المستند');
      this.emit('change');
    },
    async deleteGpItem(gpId, itemId) {
      const gp = this.data.gatePasses.find((p) => p.id === gpId);
      if (!gp) return;
      gp.items = gp.items.filter((i) => i.id !== itemId);
      await this.adapter.saveGatePass(this.project.id, gp);
      await this._log('gatepass', gp.no, 1, 'حذف بند');
      this.emit('change');
    },
    async deleteGatePass(id) {
      const gp = this.data.gatePasses.find((p) => p.id === id);
      if (!gp) return;
      await this.adapter.deleteGatePass(this.project.id, id);
      (gp.images || []).forEach((ref) => this.adapter.images.remove(ref));
      this.data.gatePasses = this.data.gatePasses.filter((p) => p.id !== id);
      await this._log('gatepass', gp.no, gp.items.length, 'حذف Gate Pass');
      this.emit('change');
    },

    /* ----- الكتالوج ----- */
    async saveCatalog(items) {
      await this.adapter.catalog.save(items);
      C.merge(items);
    },
    backup() {
      if (this.mode !== 'local') throw new Error('النسخ الاحتياطي اليدوي للوضع المحلي فقط');
      return Local.exportAll();
    },
    restore(obj) {
      Local.importAll(obj);
    },
    translateError: Sb.translateError,
  };

  MT.Store = Store;
  if (typeof module !== 'undefined' && module.exports) module.exports = { Store, Local };
})(typeof window !== 'undefined' ? window : globalThis);
