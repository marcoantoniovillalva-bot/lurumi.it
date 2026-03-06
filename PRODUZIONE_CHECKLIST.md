# Checklist prima di andare in produzione — Lurumi

## ⚡ STRIPE — Webhook di produzione (Opzione B)

Da fare **prima del lancio**, quando hai un dominio reale (es. lurumi.it).

### Passaggi:

1. **Vai su:** https://dashboard.stripe.com/webhooks
2. **Clicca:** "Aggiungi endpoint"
3. **URL endpoint:**
   ```
   https://TUO-DOMINIO.com/api/webhooks/stripe
   ```
4. **Seleziona questi eventi:**
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. **Clicca "Aggiungi endpoint"**
6. **Copia il Signing secret** (inizia con `whsec_...`)
7. **Aggiorna la variabile d'ambiente del tuo hosting:**
   ```
   STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxx
   ```

---

## 🔑 Variabili d'ambiente da configurare in produzione

Nel pannello del tuo hosting (Vercel, Railway, ecc.) aggiungi:

```
NEXT_PUBLIC_SUPABASE_URL=https://djatdyhqliotgnsljdja.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<la tua anon key>
SUPABASE_SERVICE_ROLE_KEY=<la tua service role key>

REPLICATE_API_TOKEN=<il tuo token Replicate>

STRIPE_SECRET_KEY=sk_live_<chiave LIVE, non test!>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_<chiave pubblica LIVE>
STRIPE_WEBHOOK_SECRET=whsec_<secret del webhook di produzione>
NEXT_PUBLIC_STRIPE_PRICE_ID_PREMIUM=price_<ID del prezzo Premium LIVE>
NEXT_PUBLIC_APP_URL=https://TUO-DOMINIO.com
```

> ⚠️ In produzione usa le chiavi **LIVE** di Stripe (non quelle test sk_test_...)

---

## 💳 Stripe — Creare il prodotto Premium LIVE

1. Vai su https://dashboard.stripe.com/products
2. Clicca "Aggiungi prodotto"
3. Nome: `Lurumi Premium`
4. Prezzo: `€4,99` — Ricorrente — Mensile — EUR
5. Salva e copia l'**ID prezzo** (es. `price_1AbCde...`)
6. Incollalo in `NEXT_PUBLIC_STRIPE_PRICE_ID_PREMIUM`

---

## 🗄️ Supabase — Tabelle da creare prima del lancio

Esegui queste SQL nel pannello Supabase → SQL Editor:

```sql
-- Profili utente (collegati a Stripe)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'premium')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger automatico alla registrazione
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Log generazioni AI (opzionale)
CREATE TABLE IF NOT EXISTS ai_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tool_type TEXT,
  provider TEXT,
  cost_usd NUMERIC(10,6),
  output_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS (sicurezza)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_profile" ON profiles
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "users_own_generations" ON ai_generations
  FOR ALL USING (auth.uid() = user_id);
```

---

## 🔐 Supabase — Google OAuth (se vuoi login con Google)

1. Vai su https://console.cloud.google.com
2. Crea progetto → API & Servizi → Credenziali → OAuth 2.0
3. URI di reindirizzamento autorizzato:
   ```
   https://djatdyhqliotgnsljdja.supabase.co/auth/v1/callback
   ```
4. Copia **Client ID** e **Client Secret**
5. Su Supabase → Authentication → Providers → Google → incolla le credenziali

---

## 📱 PWA — Manifest e icone

Prima del lancio, aggiorna `public/manifest.json` con:
- Nome app: `Lurumi`
- Colore tema: `#B9E5F9`
- Icone: genera con https://realfavicongenerator.net

---

## ✅ Checklist finale pre-lancio

- [ ] Dominio configurato (lurumi.it o simile)
- [ ] SSL attivo (HTTPS)
- [ ] Variabili d'ambiente produzione configurate
- [ ] Stripe in modalità LIVE (non test)
- [ ] Webhook Stripe produzione creato e testato
- [ ] Tabelle Supabase create (SQL sopra)
- [ ] Google OAuth configurato (opzionale)
- [ ] Privacy Policy e Cookie Policy aggiornate con dominio reale
- [ ] Test pagamento end-to-end con carta reale
- [ ] Backup dati verificato
