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
