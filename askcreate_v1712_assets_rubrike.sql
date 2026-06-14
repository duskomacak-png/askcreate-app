-- AskCreate v1712: rubrike / mogucnosti sredstva rada
-- Pokreni u Supabase SQL editoru da se rubrike vozila/masine trajno cuvaju.
-- Bez ovog SQL-a aplikacija ce sacuvati sredstvo, ali rubrike nece biti upisane.

ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS asset_features jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.assets.asset_features IS 'Rubrike/mogucnosti sredstva rada: kipper, lowloader, water_tanker, fuel_tanker, allow_images.';
