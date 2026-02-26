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
      AND table_name IN ('profiles','ai_generations','chat_messages','chat_sessions','notes','tutorials','projects','backups','bug_reports')
      ORDER BY table_name;
    `)
    console.log('\n📋 Tabelle presenti nel database:')
    res.rows.forEach(r => console.log(`   ✓ ${r.table_name}`))
    console.log('\n🎉 Setup completato!')
  } catch (err) {
    console.error('\n❌ Errore:', err.message)
  } finally {
    await client.end()
  }
}

run()
