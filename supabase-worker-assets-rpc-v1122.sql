-- ============================================================
-- START WORK PRO v1.12.2
-- WORKER ASSET / VEHICLE DROPDOWN
--
-- Cilj:
-- Direkcija doda mašinu/vozilo u tabelu assets.
-- Radnik se loguje preko šifre firme + šifre radnika.
-- Radnik u izveštaju vidi listu vozila svoje firme.
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
add column if not exists created_at timestamptz not null default now();

-- Radnik ne čita direktno tabelu assets. Čita preko RPC funkcije.
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
  registration text,
  capacity text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
begin
  -- Provera radnika preko šifra firme + šifra radnika
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
    raise exception 'Radnik nije pronađen ili nema dozvolu za vozila.';
  end if;

  return query
  select
    a.id,
    a.company_id,
    coalesce(a.name, '') as name,
    coalesce(a.asset_type, '') as asset_type,
    coalesce(a.registration, '') as registration,
    coalesce(a.capacity, '') as capacity,
    a.created_at
  from public.assets a
  where a.company_id = v_company_id
  order by
    case when lower(coalesce(a.asset_type, '')) in ('vehicle', 'vozilo', 'truck', 'kamion', 'kiper') then 0 else 1 end,
    a.created_at desc,
    a.name asc;
end;
$$;

grant execute on function public.worker_list_assets(text, text) to anon;
grant execute on function public.worker_list_assets(text, text) to authenticated;
