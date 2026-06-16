-- AskCreate v1714 FIX: numeric polja u assets + rubrike/mogucnosti sredstva
-- Problem koji resava: invalid input syntax for type numeric: ""
-- Aplikacija od v1714 salje NULL za prazna numeric polja. Ovaj SQL dodaje sve potrebne kolone.

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

-- Ako su ranije napravljene kolone sa _l, prebaci vrednosti u prave kolone.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'assets'
      AND column_name = 'fuel_tank_capacity_l'
  ) THEN
    UPDATE public.assets
    SET fuel_tank_capacity = COALESCE(fuel_tank_capacity, fuel_tank_capacity_l)
    WHERE fuel_tank_capacity IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'assets'
      AND column_name = 'water_tank_capacity_l'
  ) THEN
    UPDATE public.assets
    SET water_tank_capacity = COALESCE(water_tank_capacity, water_tank_capacity_l)
    WHERE water_tank_capacity IS NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.assets.fuel_norm IS 'Norma potrosnje goriva. Primer: 12 za L/MTC ili 38 za L/100km.';
COMMENT ON COLUMN public.assets.fuel_norm_unit IS 'Jedinica norme: l_per_mtc, l_per_100km ili l_per_hour.';
COMMENT ON COLUMN public.assets.fuel_tolerance_percent IS 'Dozvoljeno odstupanje potrosnje u procentima. Primer: 20.';
COMMENT ON COLUMN public.assets.asset_features IS 'Rubrike/mogucnosti sredstva: kipper, lowloader, fuel_tanker, water_tanker, service_vehicle, fixed_fuel_pump, images.';
COMMENT ON COLUMN public.assets.fuel_tank_capacity IS 'Kapacitet cisterne ili pumpe za gorivo u litrima.';
COMMENT ON COLUMN public.assets.fuel_tank_label IS 'Oznaka gorivne cisterne/pumpe: mala, velika, fiksna_pumpa, ostalo.';
COMMENT ON COLUMN public.assets.fuel_types IS 'Vrsta goriva: samo diesel.';
COMMENT ON COLUMN public.assets.water_tank_capacity IS 'Kapacitet cisterne za vodu u litrima.';
COMMENT ON COLUMN public.assets.water_tank_label IS 'Oznaka vodene cisterne: mala, velika, prikolica, ostalo.';

NOTIFY pgrst, 'reload schema';
