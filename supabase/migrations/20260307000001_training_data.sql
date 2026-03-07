-- ============================================================
-- Training Data Tables — Lurumi AI Model
-- Fase 0: Fondamenta Tecniche
-- ============================================================

-- Schemi amigurumi per il training del modello AI proprietario
CREATE TABLE IF NOT EXISTS training_patterns (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES profiles(id),
    project_id      UUID REFERENCES projects(id),
    title           TEXT NOT NULL,
    difficulty      TEXT CHECK (difficulty IN ('beginner','intermediate','advanced')),
    category        TEXT,
    yarn_weight     TEXT,
    hook_size       TEXT,
    finished_size_cm TEXT,
    parts           JSONB NOT NULL DEFAULT '[]'::jsonb,
    images          JSONB DEFAULT '[]'::jsonb,
    status          TEXT DEFAULT 'pending'
                        CHECK (status IN ('pending','validated','rejected','ground_truth')),
    admin_notes     TEXT,
    submitted_at    TIMESTAMPTZ DEFAULT NOW(),
    validated_at    TIMESTAMPTZ,
    validated_by    UUID REFERENCES profiles(id)
);

-- Feedback admin per il ciclo RLHF (Test → Errore → Correzione → Training)
CREATE TABLE IF NOT EXISTS model_feedback (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt              TEXT NOT NULL,
    model_response      JSONB NOT NULL,
    is_correct          BOOLEAN,
    corrected_response  JSONB,
    math_check_passed   BOOLEAN,
    math_errors         JSONB,
    admin_notes         TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    admin_id            UUID REFERENCES profiles(id)
);

-- Indici per query frequenti
CREATE INDEX IF NOT EXISTS idx_training_patterns_status ON training_patterns(status);
CREATE INDEX IF NOT EXISTS idx_training_patterns_category ON training_patterns(category);
CREATE INDEX IF NOT EXISTS idx_model_feedback_is_correct ON model_feedback(is_correct);

-- RLS
ALTER TABLE training_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_feedback ENABLE ROW LEVEL SECURITY;

-- Lettura pubblica: solo schemi validati o ground_truth
CREATE POLICY "training_patterns_public_read" ON training_patterns
    FOR SELECT USING (status IN ('validated', 'ground_truth'));

-- Service role bypass (gestione admin via API server-side)
-- Le operazioni di scrittura avvengono tramite service role key (bypassa RLS)
