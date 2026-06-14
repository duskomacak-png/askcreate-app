-- AskCreate v1727: lista deponija + zatvoren tok tura
-- Pokreni u Supabase SQL Editoru.
-- Deponija ima samo ime, bez adrese. Radnik kasnije bira deponiju iz liste Direkcije.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.depots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS depots_company_active_idx
  ON public.depots(company_id, active, name);

CREATE UNIQUE INDEX IF NOT EXISTS depots_company_name_unique_idx
  ON public.depots(company_id, lower(trim(name)))
  WHERE active = true;

ALTER TABLE public.depots ENABLE ROW LEVEL SECURITY;

DROP FUNCTION IF EXISTS public.director_list_depots(uuid);
CREATE OR REPLACE FUNCTION public.director_list_depots(p_company_id uuid)
RETURNS TABLE(id uuid, company_id uuid, name text, active boolean, created_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id, d.company_id, d.name, d.active, d.created_at
  FROM public.depots d
  WHERE d.company_id = p_company_id
    AND d.active = true
  ORDER BY d.name ASC;
$$;

DROP FUNCTION IF EXISTS public.director_save_depot(uuid, uuid, text);
CREATE OR REPLACE FUNCTION public.director_save_depot(
  p_company_id uuid,
  p_depot_id uuid,
  p_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_name text := trim(coalesce(p_name, ''));
BEGIN
  IF v_name = '' THEN
    RAISE EXCEPTION 'Upiši ime deponije.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.depots d
    WHERE d.company_id = p_company_id
      AND d.active = true
      AND lower(trim(d.name)) = lower(v_name)
      AND (p_depot_id IS NULL OR d.id <> p_depot_id)
  ) THEN
    RAISE EXCEPTION 'Deponija sa ovim imenom već postoji.';
  END IF;

  IF p_depot_id IS NULL THEN
    INSERT INTO public.depots(company_id, name, active)
    VALUES (p_company_id, v_name, true)
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.depots
    SET name = v_name
    WHERE id = p_depot_id
      AND company_id = p_company_id
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

DROP FUNCTION IF EXISTS public.director_archive_depot(uuid, uuid);
CREATE OR REPLACE FUNCTION public.director_archive_depot(
  p_company_id uuid,
  p_depot_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.depots
  SET active = false
  WHERE id = p_depot_id
    AND company_id = p_company_id;
  RETURN FOUND;
END;
$$;

DROP FUNCTION IF EXISTS public.worker_list_depots(text, text);
CREATE OR REPLACE FUNCTION public.worker_list_depots(
  p_company_code text,
  p_access_code text
)
RETURNS TABLE(id uuid, name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id, d.name
  FROM public.depots d
  JOIN public.companies c ON c.id = d.company_id
  JOIN public.company_users u ON u.company_id = c.id
  WHERE c.company_code = p_company_code
    AND u.access_code = p_access_code
    AND u.active = true
    AND d.active = true
  ORDER BY d.name ASC;
$$;

REVOKE ALL ON TABLE public.depots FROM PUBLIC;
REVOKE ALL ON FUNCTION public.director_list_depots(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.director_save_depot(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.director_archive_depot(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.worker_list_depots(text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.director_list_depots(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.director_save_depot(uuid, uuid, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.director_archive_depot(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.worker_list_depots(text, text) TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
