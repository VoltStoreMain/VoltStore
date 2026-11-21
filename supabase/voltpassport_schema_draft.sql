-- VoltPassport v1: DRAFT for review against the actual VoltStore Supabase schema.
-- NOT APPLIED. Confirm existing public.ads columns, RLS and local-law compliance first.
-- Deliberately uses text ad_id because public.ads.id type is absent from GitHub schema.
-- Avoid storing full IMEI numbers, documents, contact details or buyer reports.

create or replace function public.voltpassport_valid_answers(p jsonb)
returns boolean
language plpgsql immutable
set search_path = ''
as $$
declare entry record;
begin
  if p is null or jsonb_typeof(p) is distinct from 'object' or octet_length(p::text) > 8500 then
    return false;
  end if;
  for entry in select key, value from pg_catalog.jsonb_each(p) loop
    if entry.key not in ('activation','imei','screen','network','charge','battery','camera','audio','biometrics','wireless','history')
       or jsonb_typeof(entry.value) is distinct from 'object'
       or jsonb_typeof(entry.value->'status') is distinct from 'string'
       or (entry.value->>'status') not in ('ok','issue','unknown')
       or jsonb_typeof(entry.value->'note') is distinct from 'string'
       or char_length(entry.value->>'note') > 180
       or (select count(*) from pg_catalog.jsonb_object_keys(entry.value)) <> 2
    then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

create table if not exists public.ad_passports (
  ad_id text primary key check (char_length(ad_id) between 1 and 80 and ad_id ~ '^[A-Za-z0-9_-]+$'),
  seller_id uuid not null references auth.users(id),
  category text not null default 'smartphone' check (category = 'smartphone'),
  answers jsonb not null default '{}'::jsonb check (public.voltpassport_valid_answers(answers)),
  updated_at timestamptz not null default now()
);
create index if not exists ad_passports_seller_idx on public.ad_passports(seller_id);

create or replace function public.voltpassport_touch_updated_at()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists voltpassport_touch on public.ad_passports;
create trigger voltpassport_touch before update on public.ad_passports
for each row execute function public.voltpassport_touch_updated_at();

alter table public.ad_passports enable row level security;
revoke all on public.ad_passports from public, anon, authenticated;
grant select on public.ad_passports to anon, authenticated;
grant insert (ad_id, seller_id, category, answers) on public.ad_passports to authenticated;
grant update (answers) on public.ad_passports to authenticated;

-- Select only self or active/reserved listing. Existing ads RLS may restrict further.
drop policy if exists voltpassport_read on public.ad_passports;
create policy voltpassport_read on public.ad_passports
for select to anon, authenticated
using (
  exists (
    select 1 from public.ads a
    where a.id::text = ad_passports.ad_id
      and (
        a.status in ('active','reserved')
        or (select auth.uid()) = ad_passports.seller_id
      )
  )
);

-- Seller must own a real, non-removed listing; client cannot create passports for strangers.
drop policy if exists voltpassport_insert on public.ad_passports;
create policy voltpassport_insert on public.ad_passports
for insert to authenticated
with check (
  seller_id = (select auth.uid())
  and not public.is_banned()
  and exists (
    select 1 from public.ads a
    where a.id::text = ad_passports.ad_id
      and a.seller_id = (select auth.uid())
      and a.status not in ('removed','sold')
  )
);

drop policy if exists voltpassport_update on public.ad_passports;
create policy voltpassport_update on public.ad_passports
for update to authenticated
using (
  seller_id = (select auth.uid())
  and not public.is_banned()
  and exists (
    select 1 from public.ads a
    where a.id::text = ad_passports.ad_id
      and a.seller_id = (select auth.uid())
      and a.status not in ('removed','sold')
  )
)
with check (
  seller_id = (select auth.uid())
  and not public.is_banned()
  and exists (
    select 1 from public.ads a
    where a.id::text = ad_passports.ad_id
      and a.seller_id = (select auth.uid())
      and a.status not in ('removed','sold')
  )
);

-- Required review before production:
-- 1) inspect public.ads column types and ownership/visibility policies;
-- 2) test as anon, owner, other seller, banned seller, and admin;
-- 3) review Kazakhstan personal-data localisation requirements;
-- 4) decide on passport retention when ads are deleted (no FK on text ad_id).
