-- START WORK PRO by AskCreate
-- SQL dopuna v2: Direkcija aktivacija + pristup firmi
-- Nalepi u Supabase SQL Editor i klikni Run.

-- Direkcija aktivira firmu posle email login-a i pozivnog koda.
create or replace function public.activate_company(
  p_company_code text,
  p_invite_code text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_approved public.approved_companies%rowtype;
  v_company_id uuid;
begin
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));

  if v_email = '' then
    raise exception 'Morate biti prijavljeni email nalogom Direkcije.';
  end if;

  select *
  into v_approved
  from public.approved_companies
  where lower(company_code) = lower(trim(p_company_code))
    and invite_code = trim(p_invite_code)
  limit 1;

  if v_approved.id is null then
    raise exception 'Firma nije odobrena ili pozivni kod nije tačan.';
  end if;

  if lower(v_approved.approved_email) <> v_email then
    raise exception 'Email Direkcije se ne poklapa sa odobrenim emailom.';
  end if;

  if v_approved.status not in ('trial','active','pending') then
    raise exception 'Firma nije aktivna za registraciju.';
  end if;

  if v_approved.registered = true then
    select id into v_company_id
    from public.companies
    where lower(company_code) = lower(v_approved.company_code)
      and lower(owner_email) = v_email
    limit 1;

    if v_company_id is null then
      raise exception 'Firma je već registrovana drugim nalogom.';
    end if;

    return v_company_id;
  end if;

  insert into public.companies (
    name,
    company_code,
    owner_email,
    status,
    plan,
    trial_until
  )
  values (
    v_approved.company_name,
    v_approved.company_code,
    v_email,
    case when v_approved.status = 'pending' then 'trial' else v_approved.status end,
    v_approved.plan,
    v_approved.trial_until
  )
  returning id into v_company_id;

  update public.approved_companies
  set registered = true
  where id = v_approved.id;

  return v_company_id;
end;
$$;

grant execute on function public.activate_company(text, text) to authenticated;

-- Helper: vlasnik Direkcije vidi samo svoju firmu
create or replace function public.is_company_owner(p_company_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.companies c
    where c.id = p_company_id
      and lower(c.owner_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and c.status in ('trial','active')
  );
$$;

-- Policies za Direkciju
drop policy if exists "Company owner can read own company" on public.companies;
create policy "Company owner can read own company"
on public.companies
for select
to authenticated
using (
  lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

drop policy if exists "Company owner can update own company limited" on public.companies;
create policy "Company owner can update own company limited"
on public.companies
for update
to authenticated
using (
  lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
)
with check (
  lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

drop policy if exists "Company owner can manage users" on public.company_users;
create policy "Company owner can manage users"
on public.company_users
for all
to authenticated
using (public.is_company_owner(company_id))
with check (public.is_company_owner(company_id));

drop policy if exists "Company owner can manage sites" on public.sites;
create policy "Company owner can manage sites"
on public.sites
for all
to authenticated
using (public.is_company_owner(company_id))
with check (public.is_company_owner(company_id));

drop policy if exists "Company owner can manage assets" on public.assets;
create policy "Company owner can manage assets"
on public.assets
for all
to authenticated
using (public.is_company_owner(company_id))
with check (public.is_company_owner(company_id));

drop policy if exists "Company owner can manage reports" on public.reports;
create policy "Company owner can manage reports"
on public.reports
for all
to authenticated
using (public.is_company_owner(company_id))
with check (public.is_company_owner(company_id));



-- v1.10.0: Materijali za Direkciju
create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  unit text,
  category text,
  created_at timestamptz not null default now()
);

alter table public.materials enable row level security;

drop policy if exists "Company owner can manage materials" on public.materials;
create policy "Company owner can manage materials"
on public.materials
for all
to authenticated
using (public.is_company_owner(company_id))
with check (public.is_company_owner(company_id));



-- v1.10.3: dodaj archived status za reports
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'reports_status_check'
      and conrelid = 'public.reports'::regclass
  ) then
    alter table public.reports drop constraint reports_status_check;
  end if;
end $$;

alter table public.reports
add constraint reports_status_check
check (status in ('draft','sent','returned','corrected','approved','exported','archived'));



-- v1.10.5: stabilan login radnika preko šifre firme + šifre/koda radnika
drop function if exists public.worker_login(text, text);

create or replace function public.worker_login(
  p_company_code text,
  p_access_code text
)
returns table (
  user_id uuid,
  company_id uuid,
  full_name text,
  function_title text,
  permissions jsonb,
  company_name text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    cu.id as user_id,
    c.id as company_id,
    trim(coalesce(cu.first_name, '') || ' ' || coalesce(cu.last_name, '')) as full_name,
    coalesce(cu.function_title, '') as function_title,
    coalesce(cu.permissions, '{}'::jsonb) as permissions,
    c.name as company_name
  from public.company_users cu
  join public.companies c on c.id = cu.company_id
  where lower(trim(c.company_code)) = lower(trim(p_company_code))
    and lower(trim(cu.access_code)) = lower(trim(p_access_code))
    and coalesce(cu.active, true) = true
    and c.status in ('trial','active')
  limit 1;
end;
$$;

grant execute on function public.worker_login(text, text) to anon;
grant execute on function public.worker_login(text, text) to authenticated;



-- v1.10.6: spreči dupli aktivni kod radnika u istoj firmi
create unique index if not exists company_users_unique_active_access_code_per_company
on public.company_users (company_id, lower(trim(access_code)))
where coalesce(active, true) = true;


-- v1.10.9 STABLE: final worker login note
-- worker_login već koristi šifru firme + šifru radnika.


-- ============================================================
-- v1.11.8: ROBUSTAN LOGIN RADNIKA
-- Problem koji rešava:
-- Radnik mora da uđe bez email-a, samo preko:
--   1) šifra firme
--   2) šifra radnika koju je Direkcija dodelila
--
-- VAŽNO:
-- Ako radnik ne može da se uloguje posle upload-a fajlova,
-- ovaj SQL blok mora da se pokrene u Supabase SQL Editoru.
-- ============================================================

drop function if exists public.worker_login(text, text);

create or replace function public.worker_login(
  p_company_code text,
  p_access_code text
)
returns table (
  user_id uuid,
  company_id uuid,
  full_name text,
  function_title text,
  permissions jsonb,
  company_name text,
  company_code text,
  access_code text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    cu.id as user_id,
    c.id as company_id,
    trim(coalesce(cu.first_name, '') || ' ' || coalesce(cu.last_name, '')) as full_name,
    coalesce(cu.function_title, '') as function_title,
    coalesce(cu.permissions, '{}'::jsonb) as permissions,
    c.name as company_name,
    lower(trim(c.company_code)) as company_code,
    lower(trim(cu.access_code)) as access_code
  from public.company_users cu
  join public.companies c on c.id = cu.company_id
  where regexp_replace(lower(trim(coalesce(c.company_code, ''))), '\s+', '', 'g') = regexp_replace(lower(trim(coalesce(p_company_code, ''))), '\s+', '', 'g')
    and regexp_replace(lower(trim(coalesce(cu.access_code, ''))), '\s+', '', 'g') = regexp_replace(lower(trim(coalesce(p_access_code, ''))), '\s+', '', 'g')
    and coalesce(cu.active, true) = true
    and coalesce(c.status, 'active') not in ('blocked','disabled','inactive','suspended','deleted')
  limit 1;
end;
$$;

grant execute on function public.worker_login(text, text) to anon;
grant execute on function public.worker_login(text, text) to authenticated;
-- ============================================================
-- START WORK PRO v1.12.0
-- FIX: Materijali preko SECURITY DEFINER RPC funkcija
--
-- Rešava grešku:
-- new row violates row-level security policy for table "materials"
--
-- Posle ovog SQL-a aplikacija ne ubacuje materijal direktno u tabelu,
-- nego poziva bezbedne funkcije koje provere da je Direkcija vlasnik firme.
-- ============================================================

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  unit text,
  category text,
  created_at timestamptz not null default now()
);

alter table public.materials
add column if not exists company_id uuid references public.companies(id) on delete cascade;

alter table public.materials
add column if not exists name text;

alter table public.materials
add column if not exists unit text;

alter table public.materials
add column if not exists category text;

alter table public.materials
add column if not exists created_at timestamptz not null default now();

alter table public.materials enable row level security;

-- Direktne RLS policies ostaju kao dodatna zaštita.
drop policy if exists "Company owner can manage materials" on public.materials;
drop policy if exists "Company owner can select materials" on public.materials;
drop policy if exists "Company owner can insert materials" on public.materials;
drop policy if exists "Company owner can update materials" on public.materials;
drop policy if exists "Company owner can delete materials" on public.materials;

create policy "Company owner can select materials"
on public.materials
for select
to authenticated
using (
  exists (
    select 1
    from public.companies c
    where c.id = materials.company_id
      and lower(trim(c.owner_email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
      and coalesce(c.status, 'active') in ('trial', 'active', 'pending')
  )
);

create policy "Company owner can insert materials"
on public.materials
for insert
to authenticated
with check (
  exists (
    select 1
    from public.companies c
    where c.id = materials.company_id
      and lower(trim(c.owner_email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
      and coalesce(c.status, 'active') in ('trial', 'active', 'pending')
  )
);

create policy "Company owner can update materials"
on public.materials
for update
to authenticated
using (
  exists (
    select 1
    from public.companies c
    where c.id = materials.company_id
      and lower(trim(c.owner_email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
      and coalesce(c.status, 'active') in ('trial', 'active', 'pending')
  )
)
with check (
  exists (
    select 1
    from public.companies c
    where c.id = materials.company_id
      and lower(trim(c.owner_email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
      and coalesce(c.status, 'active') in ('trial', 'active', 'pending')
  )
);

create policy "Company owner can delete materials"
on public.materials
for delete
to authenticated
using (
  exists (
    select 1
    from public.companies c
    where c.id = materials.company_id
      and lower(trim(c.owner_email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
      and coalesce(c.status, 'active') in ('trial', 'active', 'pending')
  )
);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.materials to authenticated;

-- Helper provera. SECURITY DEFINER čita companies bez zapinjanja o RLS.
create or replace function public.director_can_manage_company(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.companies c
    where c.id = p_company_id
      and lower(trim(c.owner_email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
      and coalesce(c.status, 'active') in ('trial', 'active', 'pending')
  );
$$;

grant execute on function public.director_can_manage_company(uuid) to authenticated;

-- Lista materijala za firmu.
drop function if exists public.director_list_materials(uuid);
create or replace function public.director_list_materials(p_company_id uuid)
returns table (
  id uuid,
  company_id uuid,
  name text,
  unit text,
  category text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.director_can_manage_company(p_company_id) then
    raise exception 'Nemate dozvolu za materijale ove firme.';
  end if;

  return query
  select m.id, m.company_id, m.name, m.unit, m.category, m.created_at
  from public.materials m
  where m.company_id = p_company_id
  order by m.created_at desc;
end;
$$;

grant execute on function public.director_list_materials(uuid) to authenticated;

-- Jedan materijal za edit.
drop function if exists public.director_get_material(uuid, uuid);
create or replace function public.director_get_material(
  p_company_id uuid,
  p_material_id uuid
)
returns table (
  id uuid,
  company_id uuid,
  name text,
  unit text,
  category text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.director_can_manage_company(p_company_id) then
    raise exception 'Nemate dozvolu za materijale ove firme.';
  end if;

  return query
  select m.id, m.company_id, m.name, m.unit, m.category, m.created_at
  from public.materials m
  where m.company_id = p_company_id
    and m.id = p_material_id
  limit 1;
end;
$$;

grant execute on function public.director_get_material(uuid, uuid) to authenticated;

-- Dodavanje / izmena materijala.
drop function if exists public.director_upsert_material(uuid, uuid, text, text, text);
create or replace function public.director_upsert_material(
  p_company_id uuid,
  p_material_id uuid,
  p_name text,
  p_unit text,
  p_category text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.director_can_manage_company(p_company_id) then
    raise exception 'Nemate dozvolu za materijale ove firme.';
  end if;

  if nullif(trim(coalesce(p_name, '')), '') is null then
    raise exception 'Naziv materijala je obavezan.';
  end if;

  if p_material_id is null then
    insert into public.materials (company_id, name, unit, category)
    values (
      p_company_id,
      trim(p_name),
      nullif(trim(coalesce(p_unit, '')), ''),
      nullif(trim(coalesce(p_category, '')), '')
    )
    returning id into v_id;
  else
    update public.materials
    set
      name = trim(p_name),
      unit = nullif(trim(coalesce(p_unit, '')), ''),
      category = nullif(trim(coalesce(p_category, '')), '')
    where id = p_material_id
      and company_id = p_company_id
    returning id into v_id;

    if v_id is null then
      raise exception 'Materijal nije pronađen za izmenu.';
    end if;
  end if;

  return v_id;
end;
$$;

grant execute on function public.director_upsert_material(uuid, uuid, text, text, text) to authenticated;

-- Trajno brisanje materijala.
drop function if exists public.director_delete_material(uuid, uuid);
create or replace function public.director_delete_material(
  p_company_id uuid,
  p_material_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted int;
begin
  if not public.director_can_manage_company(p_company_id) then
    raise exception 'Nemate dozvolu za materijale ove firme.';
  end if;

  delete from public.materials
  where id = p_material_id
    and company_id = p_company_id;

  get diagnostics v_deleted = row_count;
  if v_deleted = 0 then
    raise exception 'Materijal nije pronađen za brisanje.';
  end if;
end;
$$;

grant execute on function public.director_delete_material(uuid, uuid) to authenticated;
-- ============================================================
-- START WORK PRO v1.12.1
-- FIX: Radnik vidi aktivna gradilišta koja je dodala Direkcija
--
-- Radnik nema email login i ne sme direktno da čita tabelu sites.
-- Zato lista gradilišta ide preko RPC funkcije:
-- worker_list_sites(p_company_code, p_access_code)
--
-- Funkcija prvo proverava par:
-- šifra firme + šifra radnika
-- i tek onda vraća aktivna gradilišta te firme.
-- ============================================================

create or replace function public.worker_list_sites(
  p_company_code text,
  p_access_code text
)
returns table (
  id uuid,
  name text,
  location text
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
        = regexp_replace(lower(trim(coalesce(p_company_code, ''))), '\s+', '', 'g')
    and regexp_replace(lower(trim(coalesce(cu.access_code, ''))), '\s+', '', 'g')
        = regexp_replace(lower(trim(coalesce(p_access_code, ''))), '\s+', '', 'g')
    and coalesce(cu.active, true) = true
    and coalesce(c.status, 'active') not in ('blocked','disabled','inactive','suspended','deleted')
  limit 1;

  if v_company_id is null then
    raise exception 'Neispravna šifra firme ili šifra radnika.';
  end if;

  return query
  select s.id, s.name, coalesce(s.location, '') as location
  from public.sites s
  where s.company_id = v_company_id
    and coalesce(s.active, true) = true
  order by s.created_at desc;
end;
$$;

grant execute on function public.worker_list_sites(text, text) to anon;
grant execute on function public.worker_list_sites(text, text) to authenticated;
