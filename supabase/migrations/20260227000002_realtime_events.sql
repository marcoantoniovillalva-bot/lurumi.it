-- Abilita Supabase Realtime per events e event_bookings
-- Necessario per la sincronizzazione dei posti e degli stati in tempo reale

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.event_bookings;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
