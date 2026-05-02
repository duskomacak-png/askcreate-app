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
