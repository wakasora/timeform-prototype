create table if not exists public.timeform_records (
  id text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  target_date text not null default '',
  segments jsonb not null,
  tags jsonb not null default '{"where":"","who":"","what":"","note":""}'::jsonb,
  is_public boolean not null default true,
  thumb text not null default '',
  deleted boolean not null default false
);

create index if not exists timeform_records_public_created_idx
  on public.timeform_records (is_public, deleted, created_at desc);

alter table public.timeform_records enable row level security;

drop policy if exists "Public can read published records" on public.timeform_records;
create policy "Public can read published records"
  on public.timeform_records
  for select
  using (is_public = true and deleted = false);

drop policy if exists "Anyone can publish a new record" on public.timeform_records;
create policy "Anyone can publish a new record"
  on public.timeform_records
  for insert
  with check (is_public = true and deleted = false);

drop policy if exists "Anyone can update prototype records" on public.timeform_records;

grant select, insert on public.timeform_records to anon;
revoke update on public.timeform_records from anon;

update public.timeform_records
set deleted = true, updated_at = now()
where id = 'test-1779959049';
