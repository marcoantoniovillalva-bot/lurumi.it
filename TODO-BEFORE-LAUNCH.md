# Da fare prima del lancio

---

## 1. Stripe — configurazione produzione

In test mode tutto funziona con le chiavi `sk_test_` / `pk_test_`.
Prima di andare live devi passare alle chiavi LIVE di Stripe.

### Passaggi:

1. **Attiva il tuo account Stripe** (completa la verifica identità su dashboard.stripe.com)

2. **Crea il prodotto e il prezzo LIVE**
   - Vai su dashboard.stripe.com → Products (assicurati di essere in modalità LIVE, non test)
   - Crea prodotto "Lurumi Premium"
   - Aggiungi prezzo: **€7,99 · Recurring · Monthly**
   - Copia il nuovo `price_LIVE_...`

3. **Chiedi a Claude di aggiornare `.env.local`** con le chiavi live:
   ```
   STRIPE_SECRET_KEY=sk_live_...
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
   NEXT_PUBLIC_STRIPE_PRICE_ID_PREMIUM=price_LIVE_...
   ```
   Oppure fallo tu direttamente nel file `.env.local`
   (e nelle variabili d'ambiente di Vercel/hosting se fai deploy)

4. **Riconfigura il Webhook Stripe** per la URL di produzione
   - Vai su dashboard.stripe.com → Developers → Webhooks
   - Aggiungi endpoint: `https://www.lurumi.it/api/webhooks/stripe`
   - Seleziona eventi: `checkout.session.completed`, `customer.subscription.deleted`
   - Copia il nuovo `whsec_...` e aggiornalo in `STRIPE_WEBHOOK_SECRET`

5. **Abilita il Customer Portal** (per "Disdici abbonamento")
   - dashboard.stripe.com → Settings → Billing → Customer portal → Activate

---

## 2. Rate limiter — migrazione a Upstash Redis (solo se deploy su Vercel)

Il rate limiter attuale (`src/lib/rate-limit.ts`) è in-memory e non funziona
tra istanze serverless diverse. Prima del lancio pubblico su Vercel:

1. Crea account gratuito su https://upstash.com (free tier: 10.000 req/giorno)
2. Crea un database Redis su Upstash e copia le variabili d'ambiente:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
3. Installa le dipendenze:
   ```
   npm install @upstash/ratelimit @upstash/redis
   ```
4. Chiedi a Claude di riscrivere `src/lib/rate-limit.ts` con Upstash
   (le route API `/api/chat` e `/api/generate-image` non vanno toccate)

> Se invece fai deploy su VPS con PM2, questo punto può essere ignorato —
> il rate limiter in-memory funziona perfettamente con un singolo processo Node.js.

---

## 3. Variabili d'ambiente su Vercel (se usi Vercel)

Tutte le variabili in `.env.local` vanno aggiunte anche su Vercel:
- Vai su vercel.com → progetto → Settings → Environment Variables
- Aggiungi ogni riga di `.env.local` (cambiando le chiavi Stripe con quelle live)
- Ricorda di aggiornare `NEXT_PUBLIC_APP_URL` con `https://www.lurumi.it`

---

## 4. Google OAuth — redirect URI produzione

- Vai su console.cloud.google.com → Credentials → OAuth 2.0 Client IDs
- Aggiungi `https://www.lurumi.it/api/auth/google/callback` agli URI autorizzati
  (quello localhost rimane per lo sviluppo locale)

---

> Quando hai fatto tutto, cancella questo file.
