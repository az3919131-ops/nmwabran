/* يتحقق من schema.sql على PostgreSQL حقيقي (PGlite) مع تقليد مخطط auth/storage في Supabase */
const path = require('path');
const fs = require('fs');
const DEPS = process.env.E2E_DEPS || path.join(process.cwd(), 'node_modules');
let fail = 0;
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) { fail++; console.log('  ✗', m, JSON.stringify(a), '≠', JSON.stringify(b)); } else console.log('  ✓', m); };

(async () => {
  const { PGlite } = await import(path.join(DEPS, '@electric-sql/pglite/dist/index.js'));
  const db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth; create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean);
    create table storage.objects (id uuid default gen_random_uuid() primary key, bucket_id text, name text);
    alter table storage.objects enable row level security;
    grant usage on schema auth, storage to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
    grant all on all tables in schema storage to authenticated;
  `);
  const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'schema.sql'), 'utf8');
  await db.exec(sql);
  await db.exec(sql); // إعادة التشغيل آمنة
  console.log('  ✓ schema.sql يعمل ويُعاد تشغيله بأمان');

  const u = '11111111-1111-1111-1111-111111111111';
  await db.exec(`insert into auth.users values ('${u}')`);
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${u}', false);`);

  // نفس العمليات التي ينفذها المحوّل
  const p = (await db.query(`insert into projects (name, region) values ('اختبار', 'نجران') returning id, created_by`)).rows[0];
  eq(p.created_by, u, 'created_by يأخذ auth.uid()');
  const mats = (await db.query(`insert into materials (code, description, unit, in_catalog) values ('908121008','T','KIT',true),('908121009','U','KIT',true),('908122008','C','EA',true),('908199999','X','EA',false) on conflict (code) do update set description = excluded.description returning id, code`)).rows;
  const id = Object.fromEntries(mats.map((m) => [m.code, m.id]));
  const again = (await db.query(`insert into materials (code, description, unit) values ('908121008','T2','KIT') on conflict (code) do update set description = excluded.description returning id`)).rows[0];
  eq(again.id, id['908121008'], 'upsert على code يعيد نفس المعرف');

  await db.query(`insert into checklist_items (project_id, material_id, required_qty, reservation_no) values ($1,$2,1,'R1'),($1,$2,1,'R2'),($1,$3,5,'R1'),($1,$4,24,'R3')`, [p.id, id['908121008'], id['908121009'], id['908122008']]);
  await db.query(`insert into uds_records (project_id, material_id, registered_qty, reference_no) values ($1,$2,2,'U1'),($1,$3,20,'U2')`, [p.id, id['908121008'], id['908122008']]);
  const gp = (await db.query(`insert into gate_passes (project_id, gate_pass_no, issue_date) values ($1,'2000538783','2026-10-14') returning id`, [p.id])).rows[0];
  await db.query(`insert into gate_pass_items (gate_pass_id, material_id, issued_qty, reservation_no) values ($1,$2,3,'R1'),($1,$3,5,'R1'),($1,$4,2,'R9')`, [gp.id, id['908121008'], id['908121009'], id['908199999']]);
  const dup = await db.query(`insert into gate_passes (project_id, gate_pass_no) values ($1,'2000538783')`, [p.id]).then(() => false, () => true);
  eq(dup, true, 'رقم Gate Pass لا يتكرر داخل المشروع');
  const neg = await db.query(`insert into checklist_items (project_id, material_id, required_qty) values ($1,$2,-1)`, [p.id, id['908121008']]).then(() => false, () => true);
  eq(neg, true, 'الكمية السالبة مرفوضة');

  const v = (await db.query(`select code, required_qty::float r, registered_qty::float u, issued_qty::float g, status from project_material_summary where project_id = $1 order by code`, [p.id])).rows;
  eq(v.map((r) => [r.code, r.r, r.u, r.g, r.status]), [
    ['908121008', 2, 2, 3, 'excess'],
    ['908121009', 5, 0, 5, 'ok'],
    ['908122008', 24, 20, 0, 'none'],
    ['908199999', 0, 0, 2, 'excess'],
  ], 'عرض الملخص يطابق منطق المقارنة في التطبيق');

  // حذف المشروع يحذف كل ما يتبعه
  await db.query(`delete from projects where id = $1`, [p.id]);
  const left = (await db.query(`select (select count(*) from checklist_items)::int c, (select count(*) from gate_pass_items)::int g, (select count(*) from gate_passes)::int p`)).rows[0];
  eq([left.c, left.g, left.p], [0, 0, 0], 'الحذف المتتالي');

  // مستخدم غير مسجل (anon) لا يصل إلى شيء
  await db.exec(`reset role; set role anon;`);
  const denied = await db.query(`select count(*) from projects`).then(() => false, () => true);
  eq(denied, true, 'anon بلا صلاحية على الجداول');
  await db.exec(`reset role;`);
  const bucket = (await db.query(`select id, public from storage.buckets`)).rows;
  eq(bucket, [{ id: 'documents', public: false }], 'مخزن documents خاص');

  if (fail) { console.log('FAILED', fail); process.exit(1); }
  console.log('OK');
})().catch((e) => { console.error(e); process.exit(1); });
