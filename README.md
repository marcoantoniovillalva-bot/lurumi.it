# Lurumi — AI-Powered Crochet & Amigurumi Platform

> A full-stack PWA built for the crochet community: AI pattern generation, interactive project tracking, live events, and a subscription model — all in one app.

**Live:** [lurumi.it](https://lurumi.it)

---

## What it does

Lurumi is a production-grade SaaS for crochet and amigurumi crafters. Users can manage their projects and tutorials, generate AI images and patterns, follow step-by-step counters, and book in-person workshops — all from a mobile-first progressive web app.

Key capabilities:
- **AI Studio** — Generate pattern images with DALL-E 3 (HD) or Replicate Flux, analyse photos with GPT-4o Vision, chat with a crochet-specialist AI (Groq Llama 3.3 70B)
- **Project & Tutorial Manager** — Full CRUD with file attachments, step counters, timers, notes, and ZIP export
- **Image Editor** — Background removal (Bria RMBG 2.0), AI background generation, brush painting, subject resize — all in-browser
- **Events & Booking** — Workshop listings, Stripe-powered seat booking with credit slider, real-time availability, waitlist with interest capture
- **AI Credits System** — Metered usage (Free: 50 cr/mo, Premium: 300 cr/mo) with anti-race-condition deduction and multi-device sync
- **Web Push Notifications** — VAPID-based push for booking confirmations and admin messages
- **Canva Integration** — OAuth flow to export generated designs directly to Canva
- **Admin Dashboard** — User management, event CRUD, AI credit grants, session analytics, peak-hours chart

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS v4 |
| Auth & Database | Supabase (PostgreSQL + Row-Level Security) |
| File Storage | Supabase Storage + Vercel Blob |
| Payments | Stripe (subscriptions + one-time event bookings, live mode) |
| AI — Text | OpenAI GPT-4o mini (chat), GPT-4o (vision) |
| AI — Image | DALL-E 3 (HD), Replicate Flux-Schnell, Flux-Dev |
| AI — Chat (free tier) | Groq Llama 3.3 70B |
| Background Removal | Replicate Bria RMBG 2.0 |
| State Management | Zustand + localStorage |
| Offline Storage | IndexedDB (custom `luDB` helper) |
| PWA | next-pwa (service worker, offline, installable) |
| Push Notifications | Web Push API + VAPID |
| OAuth | Google OAuth (manual flow, shows brand domain) + Canva OAuth |
| Email | Resend |
| Realtime | Supabase Realtime (multi-device sync for events, credits, profiles) |
| Deployment | Vercel (Edge + Serverless) |

---

## Architecture Highlights

**Feature-first layout** — every feature (`projects`, `events`, `admin`, `auth`) owns its components, hooks, server actions, and store in one directory. No jumping between 5 folders to trace one feature.

**Server Actions over API routes** — AI calls, Stripe checkout, and data mutations run as Next.js Server Actions, keeping secrets server-side and eliminating unnecessary round-trips.

**Optimistic credit locking** — AI credit deduction uses a PostgreSQL `UPDATE ... WHERE ai_credits_used + cost <= limit` pattern to prevent race conditions across concurrent requests.

**Realtime everywhere** — Supabase Realtime subscriptions keep event seat counts, booking status, and AI credit balances in sync across all connected devices without polling.

**Edge-ready middleware** — Auth guard runs at the edge via Next.js middleware + Supabase SSR, adding zero cold-start latency to protected routes.

---

## Project Structure

```
src/
├── app/                    # Next.js App Router pages & API routes
│   ├── api/               # image/, stripe/, push/, sessions/, canva/
│   └── (pages)/           # projects, tutorials, eventi, admin, profilo
├── features/              # Feature-first modules
│   ├── projects/          # store, components, actions
│   ├── events/            # booking, interest, realtime
│   └── admin/             # dashboard, user management, actions
├── hooks/                 # useAuth, useUserProfile, usePushNotifications
├── lib/                   # supabase client/server, stripe, db (IndexedDB), ai-credits
└── components/            # Shared UI: FullscreenViewer, AiCreditsBar, ...
```

---

## Database (Supabase / PostgreSQL)

All tables enforce Row-Level Security. Key tables:

`profiles` · `projects` · `tutorials` · `notes` · `chat_messages` · `ai_generations` · `events` · `event_bookings` · `event_interests` · `backups` · `bug_reports` · `user_sessions` · `push_subscriptions`

Run migrations: `node scripts/setup-db.mjs`

---

## Local Setup

```bash
git clone https://github.com/marcoantoniovillalva-bot/lurumi.it
cd lurumi.it
npm install
cp .env.local.example .env.local   # fill in your keys
npm run dev                         # starts on :3010
```

Required env vars are documented in `.env.local.example`.

---

## Deployment

Deployed on Vercel with automatic preview deployments on every push. Stripe webhooks, Supabase Realtime, and Web Push all work in production.

Stripe Customer Portal must be enabled in the Stripe Dashboard for subscription self-management.

---

## About

Built by [Marco Antonio Villalva](https://lurumi.it) — full-stack developer specialising in AI-integrated SaaS products.
