-- Aggiunge booking_count alla tabella events e un trigger per tenerlo aggiornato.
-- Questo risolve il problema Realtime: event_bookings ha RLS (solo lettura proprio utente),
-- quindi il canale Realtime non notifica gli altri utenti quando qualcuno prenota.
-- Aggiornando events.booking_count via trigger, il canale Realtime su events (pubblico)
-- notifica tutti i client connessi in tempo reale.

ALTER TABLE events ADD COLUMN IF NOT EXISTS booking_count INT DEFAULT 0;

-- Ricalcola i conteggi per gli eventi già esistenti
UPDATE events SET booking_count = (
  SELECT COUNT(*) FROM event_bookings
  WHERE event_bookings.event_id = events.id AND status = 'confirmed'
);

-- Funzione che aggiorna booking_count al variare di event_bookings
CREATE OR REPLACE FUNCTION sync_event_booking_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'confirmed' THEN
    UPDATE events SET booking_count = booking_count + 1 WHERE id = NEW.event_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'confirmed' AND NEW.status != 'confirmed' THEN
      UPDATE events SET booking_count = GREATEST(0, booking_count - 1) WHERE id = OLD.event_id;
    ELSIF OLD.status != 'confirmed' AND NEW.status = 'confirmed' THEN
      UPDATE events SET booking_count = booking_count + 1 WHERE id = NEW.event_id;
    END IF;
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'confirmed' THEN
    UPDATE events SET booking_count = GREATEST(0, booking_count - 1) WHERE id = OLD.event_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_event_booking_count ON event_bookings;
CREATE TRIGGER trg_event_booking_count
  AFTER INSERT OR UPDATE OR DELETE ON event_bookings
  FOR EACH ROW EXECUTE FUNCTION sync_event_booking_count();
