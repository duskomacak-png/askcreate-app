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
