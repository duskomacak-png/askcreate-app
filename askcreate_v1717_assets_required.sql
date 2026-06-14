-- AskCreate v1717: obavezne kolone za rubrike po sredstvu rada
-- Pokreni u Supabase SQL Editoru ako ranije nisi. Bezbedno za ponovno pokretanje.

ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS fuel_norm numeric,
  ADD COLUMN IF NOT EXISTS fuel_norm_unit text DEFAULT 'l_per_mtc',
  ADD COLUMN IF NOT EXISTS fuel_tolerance_percent numeric DEFAULT 20,
  ADD COLUMN IF NOT EXISTS asset_features jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS fuel_tank_capacity numeric,
  ADD COLUMN IF NOT EXISTS fuel_tank_label text,
  ADD COLUMN IF NOT EXISTS fuel_types jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS water_tank_capacity numeric,
  ADD COLUMN IF NOT EXISTS water_tank_label text;

NOTIFY pgrst, 'reload schema';
