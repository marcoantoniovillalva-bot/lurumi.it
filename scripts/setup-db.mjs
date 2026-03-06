/**
 * Script di migrazione Supabase — eseguire una sola volta
 * Usage: node scripts/setup-db.mjs
 */

import pg from 'pg'
const { Client } = pg

const CONNECTION_STRING = process.env.DATABASE_URL ||
  'postgresql://postgres:Quieroplata1!@db.djatdyhqliotgnsljdja.supabase.co:5432/postgres'

const client = new Client({
  connectionString: CONNECTION_STRING,
  ssl: { rejectUnauthorized: false },
})

const SQL = `
-- Profili utente (collegati a Stripe)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'premium')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Log generazioni AI
CREATE TABLE IF NOT EXISTS ai_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tool_type TEXT,
  provider TEXT,
  cost_usd NUMERIC(10,6),
  output_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messaggi (conversazioni salvate)
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  sender TEXT CHECK (sender IN ('user', 'ai')),
  message TEXT,
  image_url TEXT,
  tool_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Note personali
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Nuova Nota',
  content TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tutorial YouTube
CREATE TABLE IF NOT EXISTS tutorials (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  url TEXT NOT NULL,
  video_id TEXT,
  playlist_id TEXT,
  thumb_url TEXT,
  counter INTEGER DEFAULT 0,
  timer_seconds INTEGER DEFAULT 0,
  secs JSONB DEFAULT '[]',
  notes_html TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tutorials ADD COLUMN IF NOT EXISTS secs JSONB DEFAULT '[]';

-- Progetti (metadata + file_url da Storage)
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT CHECK (type IN ('pdf', 'images')),
  file_url TEXT,
  thumb_url TEXT,
  size BIGINT DEFAULT 0,
  counter INTEGER DEFAULT 0,
  timer_seconds INTEGER DEFAULT 0,
  notes_html TEXT DEFAULT '',
  secs JSONB DEFAULT '[]',
  images JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Canva OAuth token (aggiunto alla tabella profiles)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS canva_token TEXT;

-- Backup manuale dei dati utente
CREATE TABLE IF NOT EXISTS backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  data_json JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Titoli personalizzati delle sessioni chat
CREATE TABLE IF NOT EXISTS chat_sessions (
  id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  tool_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, user_id)
);

-- Segnalazioni bug
CREATE TABLE IF NOT EXISTS bug_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  steps TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Admin + Events ───────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS event_credit NUMERIC(10,2) DEFAULT 0;

CREATE TABLE IF NOT EXISTS events (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT,
  image_url     TEXT,
  image_urls    TEXT[] DEFAULT '{}',
  cost          NUMERIC(10,2) NOT NULL DEFAULT 0,
  event_date    TIMESTAMPTZ NOT NULL,
  access_link   TEXT,
  max_participants INT,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Migrazione per aggiungere image_urls se la tabella esisteva già
ALTER TABLE events ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT '{}';

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

-- Durata evento
ALTER TABLE events ADD COLUMN IF NOT EXISTS duration_minutes INT;

-- Interessi utenti per eventi sold-out
CREATE TABLE IF NOT EXISTS event_interests (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id      UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email    TEXT,
  preferred_date TEXT,
  message       TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE event_interests ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='event_interests' AND policyname='interests_user_insert') THEN
    CREATE POLICY "interests_user_insert" ON event_interests FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL); END IF; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='event_interests' AND policyname='interests_user_read') THEN
    CREATE POLICY "interests_user_read" ON event_interests FOR SELECT USING (auth.uid() = user_id); END IF; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='event_interests' AND policyname='interests_admin_all') THEN
    CREATE POLICY "interests_admin_all" ON event_interests FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)); END IF; END $$;

-- Messaggi privati admin↔utente relativi a un interesse evento
CREATE TABLE IF NOT EXISTS interest_messages (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  interest_id UUID REFERENCES event_interests(id) ON DELETE CASCADE NOT NULL,
  sender_id   UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('admin', 'user')),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE interest_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='interest_messages' AND policyname='imsg_read') THEN
    CREATE POLICY "imsg_read" ON interest_messages FOR SELECT USING (
      EXISTS (SELECT 1 FROM event_interests WHERE id = interest_messages.interest_id AND user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    );
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='interest_messages' AND policyname='imsg_user_insert') THEN
    CREATE POLICY "imsg_user_insert" ON interest_messages FOR INSERT WITH CHECK (
      sender_id = auth.uid()
      AND (
        (sender_role = 'user' AND EXISTS (
          SELECT 1 FROM event_interests WHERE id = interest_messages.interest_id AND user_id = auth.uid()
        ))
        OR
        (sender_role = 'admin' AND EXISTS (
          SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
        ))
      )
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS user_sessions (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  started_at       TIMESTAMPTZ DEFAULT now(),
  ended_at         TIMESTAMPTZ,
  duration_seconds INT
);

CREATE INDEX IF NOT EXISTS user_sessions_user_started ON user_sessions(user_id, started_at DESC);

-- Abilita Realtime per interest_messages (cross-device sync)
-- Gestisce sia pubblicazioni FOR ALL TABLES sia quelle per tabelle specifiche
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE interest_messages;
EXCEPTION WHEN OTHERS THEN
  NULL; -- già inclusa (es. pubblicazione FOR ALL TABLES)
END $$;

-- ── Colonna booking_count su events (aggiornata da trigger) ─────────────────
-- Permette il Realtime dei posti per tutti gli utenti senza bypassare RLS su event_bookings
ALTER TABLE events ADD COLUMN IF NOT EXISTS booking_count INT DEFAULT 0;

-- Ricalcola i conteggi esistenti
UPDATE events SET booking_count = (
  SELECT COUNT(*) FROM event_bookings
  WHERE event_bookings.event_id = events.id AND status = 'confirmed'
);

-- Funzione trigger per mantenere aggiornato booking_count
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

-- Abilita Realtime su events e event_bookings (sync posti, stato evento)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE events;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE event_bookings;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS event_bookings_event_id ON event_bookings(event_id);

-- ── AI Credits System ────────────────────────────────────────
-- Crediti AI mensili: free=50, premium=300
-- ai_credits_used si azzera automaticamente ogni 30 giorni
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ai_credits_used INT DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ai_credits_reset_at TIMESTAMPTZ DEFAULT NOW();

-- Tema personaggio scelto dall'utente (default: luly)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS character_theme TEXT DEFAULT 'luly';

-- Abilita Realtime su profiles per sync crediti multi-device
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Web Push subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  endpoint   TEXT NOT NULL,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='push_subscriptions' AND policyname='push_sub_user_own') THEN
    CREATE POLICY "push_sub_user_own" ON push_subscriptions FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='events' AND policyname='events_public_read') THEN
    CREATE POLICY "events_public_read" ON events FOR SELECT USING (true); END IF; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='events' AND policyname='events_admin_insert') THEN
    CREATE POLICY "events_admin_insert" ON events FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)); END IF; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='events' AND policyname='events_admin_update') THEN
    CREATE POLICY "events_admin_update" ON events FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)); END IF; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='events' AND policyname='events_admin_delete') THEN
    CREATE POLICY "events_admin_delete" ON events FOR DELETE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)); END IF; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='event_bookings' AND policyname='bookings_user_own_read') THEN
    CREATE POLICY "bookings_user_own_read" ON event_bookings FOR SELECT USING (auth.uid() = user_id); END IF; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='event_bookings' AND policyname='bookings_user_insert') THEN
    CREATE POLICY "bookings_user_insert" ON event_bookings FOR INSERT WITH CHECK (auth.uid() = user_id); END IF; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='event_bookings' AND policyname='bookings_user_update') THEN
    CREATE POLICY "bookings_user_update" ON event_bookings FOR UPDATE USING (auth.uid() = user_id); END IF; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='event_bookings' AND policyname='bookings_admin_all') THEN
    CREATE POLICY "bookings_admin_all" ON event_bookings FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)); END IF; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_sessions' AND policyname='sessions_user_insert') THEN
    CREATE POLICY "sessions_user_insert" ON user_sessions FOR INSERT WITH CHECK (auth.uid() = user_id); END IF; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_sessions' AND policyname='sessions_user_read') THEN
    CREATE POLICY "sessions_user_read" ON user_sessions FOR SELECT USING (auth.uid() = user_id); END IF; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_sessions' AND policyname='sessions_user_update') THEN
    CREATE POLICY "sessions_user_update" ON user_sessions FOR UPDATE USING (auth.uid() = user_id); END IF; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_sessions' AND policyname='sessions_admin_read') THEN
    CREATE POLICY "sessions_admin_read" ON user_sessions FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)); END IF; END $$;

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutorials ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'users_own_profile') THEN
    CREATE POLICY "users_own_profile" ON profiles FOR ALL USING (auth.uid() = id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_generations' AND policyname = 'users_own_generations') THEN
    CREATE POLICY "users_own_generations" ON ai_generations FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_messages' AND policyname = 'users_own_chat') THEN
    CREATE POLICY "users_own_chat" ON chat_messages FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notes' AND policyname = 'users_own_notes') THEN
    CREATE POLICY "users_own_notes" ON notes FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tutorials' AND policyname = 'users_own_tutorials') THEN
    CREATE POLICY "users_own_tutorials" ON tutorials FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'projects' AND policyname = 'users_own_projects') THEN
    CREATE POLICY "users_own_projects" ON projects FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'backups' AND policyname = 'users_own_backups') THEN
    CREATE POLICY "users_own_backups" ON backups FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_sessions' AND policyname = 'users_own_chat_sessions') THEN
    CREATE POLICY "users_own_chat_sessions" ON chat_sessions FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bug_reports' AND policyname = 'users_insert_bug_reports') THEN
    CREATE POLICY "users_insert_bug_reports" ON bug_reports FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
  END IF;
END $$;

-- Impostazioni admin (key/value store — accessibile solo da service role)
CREATE TABLE IF NOT EXISTS admin_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO admin_settings (key, value) VALUES
  ('monthly_budget_usd', '50'),
  ('auto_disable_ai',    'false'),
  ('ai_disabled',        'false')
ON CONFLICT (key) DO NOTHING;
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

-- Depositi/ricariche AI (traccia quando l'admin ricarica OpenAI o Replicate)
CREATE TABLE IF NOT EXISTS ai_deposits (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount_usd DECIMAL(10,4) NOT NULL,
  provider   TEXT NOT NULL DEFAULT 'all',
  note       TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE ai_deposits ENABLE ROW LEVEL SECURITY;

-- ── Sistema di supporto ticket ────────────────────────────────
-- Aggiunge status e email del mittente alle segnalazioni bug
ALTER TABLE bug_reports ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'open';
ALTER TABLE bug_reports ADD COLUMN IF NOT EXISTS user_email TEXT;

-- ── Immagine di copertina progetto ────────────────────────────────────────────
ALTER TABLE projects ADD COLUMN IF NOT EXISTS cover_image_id TEXT;

-- Permetti agli utenti di leggere le proprie segnalazioni (necessario per il thread)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='bug_reports' AND policyname='bug_reports_user_select') THEN
    CREATE POLICY "bug_reports_user_select" ON bug_reports
      FOR SELECT USING (
        user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
      );
  END IF;
END $$;

-- Messaggi di supporto (conversazione bidirezionale utente ↔ admin)
CREATE TABLE IF NOT EXISTS support_messages (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bug_report_id  UUID REFERENCES bug_reports(id) ON DELETE CASCADE NOT NULL,
  sender_type    TEXT CHECK (sender_type IN ('user', 'admin')) NOT NULL,
  sender_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  content        TEXT NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

-- Utente legge i messaggi delle proprie segnalazioni; admin legge tutti
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='support_messages' AND policyname='support_messages_select') THEN
    CREATE POLICY "support_messages_select" ON support_messages
      FOR SELECT USING (
        bug_report_id IN (SELECT id FROM bug_reports WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
      );
  END IF;
END $$;

-- Abilita Realtime su support_messages e bug_reports per notifiche in tempo reale
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE support_messages;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE bug_reports;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ── Libreria: libri e schemi caricati dall'admin ───────────────
CREATE TABLE IF NOT EXISTS library_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  description  TEXT DEFAULT '',
  item_type    TEXT NOT NULL DEFAULT 'schema' CHECK (item_type IN ('schema', 'book')),
  tier         TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'premium')),
  language     TEXT,
  cover_urls   TEXT[] DEFAULT '{}',
  content_type TEXT NOT NULL DEFAULT 'pdf' CHECK (content_type IN ('pdf', 'sections')),
  pdf_url      TEXT,
  sections     JSONB DEFAULT '[]',
  is_published BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE library_items ENABLE ROW LEVEL SECURITY;

-- Utenti autenticati leggono solo gli elementi pubblicati
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='library_items' AND policyname='library_items_user_read') THEN
    CREATE POLICY "library_items_user_read" ON library_items
      FOR SELECT USING (is_published = true AND auth.uid() IS NOT NULL);
  END IF;
END $$;

-- Admin può fare tutto (incluso vedere non pubblicati)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='library_items' AND policyname='library_items_admin_all') THEN
    CREATE POLICY "library_items_admin_all" ON library_items
      FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
  END IF;
END $$;

-- Abilita Realtime su library_items (aggiornamenti in tempo reale agli utenti)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE library_items;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ── Email preferences (GDPR) ────────────────────────────────────────────────
-- newsletter_opt_in: legittimo interesse (pre-checked) — novità prodotto
-- marketing_opt_in:  consenso esplicito (unchecked) — offerte e promozioni
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS newsletter_opt_in BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS marketing_opt_in BOOLEAN DEFAULT false;

-- ── Library video URL ────────────────────────────────────────────────────────
ALTER TABLE library_items ADD COLUMN IF NOT EXISTS video_url TEXT;

-- ── Gender detection (rilevato via Groq AI al primo accesso) ─────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender TEXT; -- 'f' | 'm' | null

-- ── Email Marketing System ───────────────────────────────────────────────────

-- Campagne email manuali (draft → approved → sent)
CREATE TABLE IF NOT EXISTS email_campaigns (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  subject        TEXT NOT NULL DEFAULT '',
  body_html      TEXT NOT NULL DEFAULT '',
  status         TEXT NOT NULL DEFAULT 'draft',
  target         TEXT NOT NULL DEFAULT 'newsletter',
  recipient_count INT,
  sent_count     INT DEFAULT 0,
  approved_at    TIMESTAMPTZ,
  sent_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Sequenze nurturing (trigger-based)
CREATE TABLE IF NOT EXISTS email_sequences (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  is_active    BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Step di ogni sequenza
CREATE TABLE IF NOT EXISTS email_sequence_steps (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID REFERENCES email_sequences(id) ON DELETE CASCADE,
  step_order  INT NOT NULL DEFAULT 0,
  delay_days  INT NOT NULL DEFAULT 0,
  subject     TEXT NOT NULL DEFAULT '',
  body_html   TEXT NOT NULL DEFAULT '',
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Enrollment utenti nelle sequenze
CREATE TABLE IF NOT EXISTS email_sequence_enrollments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL,
  user_email   TEXT NOT NULL,
  sequence_id  UUID REFERENCES email_sequences(id) ON DELETE CASCADE,
  current_step INT DEFAULT 0,
  enrolled_at  TIMESTAMPTZ DEFAULT NOW(),
  next_send_at TIMESTAMPTZ,
  status       TEXT DEFAULT 'active',
  metadata     JSONB,
  UNIQUE(user_id, sequence_id)
);

-- Log di tutte le email inviate
CREATE TABLE IF NOT EXISTS email_send_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id      UUID,
  sequence_step_id UUID,
  user_id          UUID,
  user_email       TEXT NOT NULL,
  subject          TEXT NOT NULL,
  status           TEXT DEFAULT 'sent',
  error            TEXT,
  sent_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Email ricevute dagli utenti (via Resend Inbound webhook)
CREATE TABLE IF NOT EXISTS received_emails (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_email  TEXT NOT NULL,
  from_name   TEXT,
  subject     TEXT NOT NULL,
  body_text   TEXT,
  body_html   TEXT,
  is_read     BOOLEAN DEFAULT false,
  received_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sequence_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_send_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE received_emails ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS email_seq_enrollments_next ON email_sequence_enrollments(next_send_at, status);
CREATE INDEX IF NOT EXISTS email_send_logs_sent ON email_send_logs(sent_at DESC);

-- ── Linked entity columns for email_sequences (v2) ────────────────────────────
ALTER TABLE email_sequences ADD COLUMN IF NOT EXISTS linked_event_id UUID;
ALTER TABLE email_sequences ADD COLUMN IF NOT EXISTS linked_library_item_id UUID;
ALTER TABLE email_sequences ADD COLUMN IF NOT EXISTS linked_youtube_url TEXT;
ALTER TABLE email_sequences ADD COLUMN IF NOT EXISTS linked_entity_title TEXT;
ALTER TABLE email_sequences ADD COLUMN IF NOT EXISTS linked_entity_description TEXT;

-- ── Tutorial transcript storage ───────────────────────────────────────────────
ALTER TABLE tutorials ADD COLUMN IF NOT EXISTS transcript_data JSONB;
`

async function run() {
  try {
    console.log('🔌 Connessione al database Supabase...')
    await client.connect()
    console.log('✅ Connesso!')

    console.log('🏗️  Esecuzione migrazioni...')
    await client.query(SQL)
    console.log('✅ Tabelle create con successo!')

    const res = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('profiles','ai_generations','chat_messages','chat_sessions','notes','tutorials','projects','backups','bug_reports','events','event_bookings','event_interests','interest_messages','user_sessions','push_subscriptions','admin_settings','ai_deposits','library_items')

      ORDER BY table_name;
    `)
    console.log('\n📋 Tabelle presenti nel database:')
    res.rows.forEach(r => console.log(`   ✓ ${r.table_name}`))
    console.log('\n🎉 Setup completato!')
    console.log('\n📦 Bucket Storage da creare manualmente in Supabase Dashboard (se non esistono):')
    console.log('   ✓ event-covers     (Public)')
    console.log('   ✓ library-content  (Public) — per copertine, PDF e immagini sezioni libreria')
  } catch (err) {
    console.error('\n❌ Errore:', err.message)
  } finally {
    await client.end()
  }
}

run()
