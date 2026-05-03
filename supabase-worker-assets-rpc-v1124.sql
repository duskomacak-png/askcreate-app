-- ============================================================
-- START WORK PRO v1.12.4
-- FIX: Radnik vidi vozila iz Direkcije + kapacitet vozila za m3 račun
--
-- Problem koji rešava:
-- - u Direkciji su vozila upisana u kolonu asset_type
-- - stara RPC funkcija je vraćala type ili pogrešno ime kolone
-- - radnik zato vidi "Nema vozila iz Direkcije"
--
-- Funkcija:
-- worker_list_assets(p_company_code, p_access_code)
-- ============================================================

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  asset_type text,
  registration text,
  capacity text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.assets
add column if not exists company_id uuid references public.companies(id) on delete cascade;

alter table public.assets
add column if not exists name text;

alter table public.assets
add column if not exists asset_type text;

alter table public.assets
add column if not exists registration text;

alter table public.assets
add column if not exists capacity text;

alter table public.assets
add column if not exists active boolean not null default true;

alter table public.assets
add column if not exists created_at timestamptz not null default now();

-- Ako je ranije greškom napravljena kolona type, prepiši vrednost u asset_type
-- samo tamo gde asset_type fali.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'assets'
      and column_name = 'type'
  ) then
    execute 'update public.assets set asset_type = coalesce(asset_type, type) where asset_type is null or asset_type = ''''';
  end if;
end $$;

drop function if exists public.worker_list_assets(text, text);

create or replace function public.worker_list_assets(
  p_company_code text,
  p_access_code text
)
returns table (
  id uuid,
  company_id uuid,
  name text,
  asset_type text,
  type text,
  registration text,
  capacity text,
  active boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
begin
  select c.id
  into v_company_id
  from public.company_users cu
  join public.companies c on c.id = cu.company_id
  where regexp_replace(lower(trim(coalesce(c.company_code, ''))), '\s+', '', 'g')
        =
        regexp_replace(lower(trim(coalesce(p_company_code, ''))), '\s+', '', 'g')
    and regexp_replace(lower(trim(coalesce(cu.access_code, ''))), '\s+', '', 'g')
        =
        regexp_replace(lower(trim(coalesce(p_access_code, ''))), '\s+', '', 'g')
    and coalesce(cu.active, true) = true
    and coalesce(c.status, 'active') not in ('blocked', 'disabled', 'inactive', 'suspended', 'deleted')
  limit 1;

  if v_company_id is null then
    raise exception 'Radnik nije pronađen ili nema dozvolu.';
  end if;

  return query
  select
    a.id,
    a.company_id,
    coalesce(a.name, '') as name,
    coalesce(a.asset_type, '') as asset_type,
    coalesce(a.asset_type, '') as type,
    coalesce(a.registration, '') as registration,
    coalesce(a.capacity, '') as capacity,
    coalesce(a.active, true) as active
  from public.assets a
  where a.company_id = v_company_id
    and coalesce(a.active, true) = true
    and lower(coalesce(a.asset_type, '')) in ('vehicle', 'vozilo', 'truck', 'kamion', 'kiper', 'cisterna', 'lowloader', 'labudica')
  order by a.name asc;
end;
$$;

grant execute on function public.worker_list_assets(text, text) to anon;
grant execute on function public.worker_list_assets(text, text) to authenticated;
