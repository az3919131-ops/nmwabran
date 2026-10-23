-- متابعة صرف المواد من الكهرباء: مخطط قاعدة بيانات Supabase
-- الاستخدام: Supabase > SQL Editor > New query > الصق هذا الملف كاملًا > Run
-- آمن لإعادة التشغيل أكثر من مرة.

-- ============ الجداول ============

create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  region      text,
  contractor  text,
  notes       text,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now()
);

-- المواد: الكود (9 أرقام SEC) والوصف والوحدة. تُضاف تلقائيًا من التطبيق عند أول استخدام.
create table if not exists public.materials (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  description text,
  unit        text,
  category    text,
  in_catalog  boolean not null default false,
  created_at  timestamptz not null default now()
);

-- (1) المطلوب صرفه: قائمة Checklist
create table if not exists public.checklist_items (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects(id) on delete cascade,
  material_id     uuid not null references public.materials(id),
  required_qty    numeric not null default 0 check (required_qty >= 0),
  reservation_no  text,
  item_no         text,
  work_order      text,
  wo_type         text,
  unloading_point text,
  doc_desc        text,
  uom             text,
  created_by      uuid default auth.uid(),
  created_at      timestamptz not null default now()
);

-- (2) المسجّل على نظام UDS
create table if not exists public.uds_records (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects(id) on delete cascade,
  material_id     uuid not null references public.materials(id),
  registered_qty  numeric not null default 0 check (registered_qty >= 0),
  reference_no    text,
  reservation_no  text,
  doc_desc        text,
  created_by      uuid default auth.uid(),
  created_at      timestamptz not null default now()
);

-- (3) المصروف فعليًا: مستندات Gate Pass وبنودها
create table if not exists public.gate_passes (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.projects(id) on delete cascade,
  gate_pass_no     text not null,
  issue_date       date,
  image_paths      jsonb not null default '[]'::jsonb,
  notes            text,
  erp_delivery     text,
  material_doc     text,
  plant            text,
  storage_location text,
  contractor       text,
  created_by       uuid default auth.uid(),
  created_at       timestamptz not null default now(),
  unique (project_id, gate_pass_no)
);

create table if not exists public.gate_pass_items (
  id             uuid primary key default gen_random_uuid(),
  gate_pass_id   uuid not null references public.gate_passes(id) on delete cascade,
  material_id    uuid not null references public.materials(id),
  issued_qty     numeric not null default 0 check (issued_qty >= 0),
  reservation_no text,
  line_no        text,
  uom            text,
  doc_desc       text
);

-- سجل العمليات
create table if not exists public.activity_log (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  kind        text not null check (kind in ('checklist', 'uds', 'gatepass')),
  ref         text,
  items_count integer not null default 0,
  note        text,
  image_path  text,
  user_email  text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_checklist_project on public.checklist_items (project_id, material_id);
create index if not exists idx_checklist_res     on public.checklist_items (project_id, reservation_no);
create index if not exists idx_uds_project       on public.uds_records (project_id, material_id);
create index if not exists idx_gp_project        on public.gate_passes (project_id, issue_date);
create index if not exists idx_gpi_gp            on public.gate_pass_items (gate_pass_id);
create index if not exists idx_gpi_material      on public.gate_pass_items (material_id);
create index if not exists idx_activity_project  on public.activity_log (project_id, created_at desc);

-- ============ عرض: المصروف الفعلي لكل مادة = مجموع كمياتها عبر كل الـ Gate Pass ============
create or replace view public.project_material_summary
with (security_invoker = true) as
with keys as (
  select project_id, material_id from public.checklist_items
  union
  select project_id, material_id from public.uds_records
  union
  select gp.project_id, i.material_id
  from public.gate_pass_items i join public.gate_passes gp on gp.id = i.gate_pass_id
),
cl as (select project_id, material_id, sum(required_qty) as q from public.checklist_items group by 1, 2),
u  as (select project_id, material_id, sum(registered_qty) as q from public.uds_records group by 1, 2),
g  as (
  select gp.project_id, i.material_id, sum(i.issued_qty) as q
  from public.gate_pass_items i join public.gate_passes gp on gp.id = i.gate_pass_id
  group by 1, 2
),
j as (
  select k.project_id, k.material_id,
         cl.q as cl_q, u.q as uds_q, coalesce(g.q, 0) as gp_q,
         coalesce(cl.q, u.q) as base_q
  from keys k
  left join cl on cl.project_id = k.project_id and cl.material_id = k.material_id
  left join u  on u.project_id  = k.project_id and u.material_id  = k.material_id
  left join g  on g.project_id  = k.project_id and g.material_id  = k.material_id
)
select j.project_id,
       m.code,
       m.description,
       m.unit,
       coalesce(j.cl_q, 0)  as required_qty,
       coalesce(j.uds_q, 0) as registered_qty,
       j.gp_q               as issued_qty,
       case
         when j.base_q is null and j.gp_q > 0 then 'excess'
         when j.base_q is null then 'na'
         when j.gp_q <= 0 and j.base_q > 0 then 'none'
         when j.gp_q <= 0 then 'ok'
         when j.gp_q < j.base_q then 'short'
         when j.gp_q > j.base_q then 'excess'
         else 'ok'
       end as status
from j
join public.materials m on m.id = j.material_id;

-- ============ الأمان (RLS) ============
-- كل مستخدم مسجّل الدخول يرى ويعدّل كل المشاريع (فريق صغير موثوق).
-- مهم: أوقف التسجيل الذاتي من Authentication > Providers > Email > Allow new users to sign up،
-- وأضف المستخدمين يدويًا من Authentication > Users. غير المسجّلين لا يصلون إلى أي بيانات.

alter table public.projects         enable row level security;
alter table public.materials        enable row level security;
alter table public.checklist_items  enable row level security;
alter table public.uds_records      enable row level security;
alter table public.gate_passes      enable row level security;
alter table public.gate_pass_items  enable row level security;
alter table public.activity_log     enable row level security;

do $$
declare t text;
begin
  foreach t in array array['projects','materials','checklist_items','uds_records','gate_passes','gate_pass_items','activity_log']
  loop
    execute format('drop policy if exists "team access" on public.%I', t);
    execute format('create policy "team access" on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- ============ مخزن صور المستندات (خاص) ============
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

drop policy if exists "documents team access" on storage.objects;
create policy "documents team access" on storage.objects
  for all to authenticated
  using (bucket_id = 'documents')
  with check (bucket_id = 'documents');
