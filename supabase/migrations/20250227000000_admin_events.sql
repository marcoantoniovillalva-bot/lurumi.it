-- ============================================================
-- Admin + Events migration — 2025-02-27
-- ============================================================

-- Estensioni profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS event_credit NUMERIC(10,2) DEFAULT 0;

-- ── Events ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT,
  image_url     TEXT,
  cost          NUMERIC(10,2) NOT NULL DEFAULT 0,
  event_date    TIMESTAMPTZ NOT NULL,
  access_link   TEXT,
  max_participants INT,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ── Event Bookings ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_bookings (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id         UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  user_email       TEXT,
  amount_paid      NUMERIC(10,2) NOT NULL DEFAULT 0,
  credit_used      NUMERIC(10,2) NOT NULL DEFAULT 0,
  status           TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed','cancelled','pending')),
  stripe_session_id TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- ── User Sessions (analytics) ────────────────────────────────
CREATE TABLE IF NOT EXISTS user_sessions (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  started_at       TIMESTAMPTZ DEFAULT now(),
  ended_at         TIMESTAMPTZ,
  duration_seconds INT
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS user_sessions_user_started ON user_sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS event_bookings_event_id ON event_bookings(event_id);

-- ── RLS ─────────────────────────────────────────────────────
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Events policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='events' AND policyname='events_public_read') THEN
    CREATE POLICY "events_public_read" ON events FOR SELECT USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='events' AND policyname='events_admin_insert') THEN
    CREATE POLICY "events_admin_insert" ON events FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    );
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='events' AND policyname='events_admin_update') THEN
    CREATE POLICY "events_admin_update" ON events FOR UPDATE USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    );
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='events' AND policyname='events_admin_delete') THEN
    CREATE POLICY "events_admin_delete" ON events FOR DELETE USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    );
  END IF;
END $$;

-- Event bookings policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='event_bookings' AND policyname='bookings_user_own_read') THEN
    CREATE POLICY "bookings_user_own_read" ON event_bookings FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='event_bookings' AND policyname='bookings_user_insert') THEN
    CREATE POLICY "bookings_user_insert" ON event_bookings FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='event_bookings' AND policyname='bookings_user_update') THEN
    CREATE POLICY "bookings_user_update" ON event_bookings FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='event_bookings' AND policyname='bookings_admin_all') THEN
    CREATE POLICY "bookings_admin_all" ON event_bookings FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    );
  END IF;
END $$;

-- User sessions policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_sessions' AND policyname='sessions_user_insert') THEN
    CREATE POLICY "sessions_user_insert" ON user_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_sessions' AND policyname='sessions_user_read') THEN
    CREATE POLICY "sessions_user_read" ON user_sessions FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_sessions' AND policyname='sessions_user_update') THEN
    CREATE POLICY "sessions_user_update" ON user_sessions FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_sessions' AND policyname='sessions_admin_read') THEN
    CREATE POLICY "sessions_admin_read" ON user_sessions FOR SELECT USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    );
  END IF;
END $$;
