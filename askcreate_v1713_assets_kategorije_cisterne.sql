-- AskCreate v1713: jednostavna kategorija + namene/mogućnosti sredstva rada
-- Kategorija u aplikaciji ostaje samo: machine ili vehicle.
-- Kiper, labudica, cisterne, fiksna pumpa, slike i goriva čuvaju se kao rubrike/mogućnosti.

ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS asset_features jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS fuel_tank_capacity numeric,
  ADD COLUMN IF NOT EXISTS fuel_tank_label text,
  ADD COLUMN IF NOT EXISTS fuel_types jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS water_tank_capacity numeric,
  ADD COLUMN IF NOT EXISTS water_tank_label text;

COMMENT ON COLUMN public.assets.asset_features IS 'Namene/mogućnosti sredstva: kipper, lowloader, fuel_tanker, water_tanker, service_vehicle, fixed_fuel_pump, allow_images.';
COMMENT ON COLUMN public.assets.fuel_tank_capacity IS 'Kapacitet cisterne/pumpe za gorivo u litrima.';
COMMENT ON COLUMN public.assets.fuel_tank_label IS 'Oznaka cisterne/pumpe za gorivo: mala, velika, pumpa_baza, ostalo.';
COMMENT ON COLUMN public.assets.fuel_types IS 'Vrsta goriva koju sredstvo nosi/sipa: samo dizel.';
COMMENT ON COLUMN public.assets.water_tank_capacity IS 'Kapacitet cisterne za vodu u litrima.';
COMMENT ON COLUMN public.assets.water_tank_label IS 'Oznaka cisterne za vodu: mala, velika, prikolica, ostalo.';
