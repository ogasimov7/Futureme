# Future Roast — Implementation Plan

Status as of 2026-10-27. This document is the working plan; update the checklist as stages land.

## 1. Audit (starting state)

- The working directory was **empty** (no git repo, no code). The project was scaffolded with
  `create-expo-app` (default template) and the demo screens were removed.
- Toolchain on this machine:
  - Node 22.11 is the nvm default, but **Expo SDK 58 / Metro 0.87 require Node ≥ 22.13 or ≥ 24.3**.
    `.nvmrc` pins Node 24 (installed: 24.14.1). Run `nvm use` before any command.
  - npm 10.9, Supabase CLI 2.75 (outdated; 2.122 available), watchman installed.
  - **No Docker** → `supabase start` cannot run yet. The migration was instead applied to
    PGlite (Postgres 17 in WASM) with a stubbed `auth` schema, and RLS was checked there
    (see §9). It has not yet run on a real Supabase stack.
  - **No full Xcode** (Command Line Tools only) → no iOS simulator. Verification in this stage is
    typecheck + lint + unit tests + web bundle. Native verification needs Expo Go / a dev build
    on a device, or EAS.

## 2. Stack (verified versions)

| Concern | Choice | Version |
|---|---|---|
| Runtime | Expo SDK | 58.0.x (React Native 0.88, React 19.3) |
| Language | TypeScript | 6.0 (strict) |
| Navigation | Expo Router, JS tabs (`expo-router/js-tabs`) + Stack | 58.0.x |
| Icons | `expo-symbols` (SF Symbols on iOS, Material Symbols on Android/web) | bundled with template |
| Fonts | `@expo-google-fonts/fraunces` (display serif), `@expo-google-fonts/dm-sans` (UI text) | 0.4.x |
| Tests | `jest-expo` + `jest` | 58.0.x / 30.x |
| Backend (stage 2+) | Supabase Auth, Postgres, Edge Functions, `pg_cron` + `pg_net` | — |
| AI | Gemini API (free tier) via Expo API routes; Claude remains an option | `gemini-3.5-flash-lite` |
| Push (stage 4) | `expo-notifications` + Expo Push Service | — |
| Payments | RevenueCat — **not** in scope until paid tiers exist | — |

**Dependencies added in stage 1.5:** `@react-native-async-storage/async-storage`, `react-native-view-shot`, `expo-sharing`.

**Dependencies added in stage 1:** the two font packages, the Jest tooling listed above, and
`eslint` + `eslint-config-expo` (dev only, installed by `expo lint` on first run). Nothing else. `@supabase/supabase-js`, `expo-secure-store` and `expo-notifications` will be added in
the stages that use them.

Why JS tabs instead of `NativeTabs`: the brand calls for a custom dark tab bar with a yellow accent that looks
the same on iOS, Android and web. Native tabs follow the system look (Liquid Glass on iOS 26)
and render through a separate code path on web. This is easy to revisit later.

## 3. Architecture

```
src/
  app/                    Expo Router routes only
    _layout.tsx           fonts, providers, root Stack
    (tabs)/_layout.tsx    5 tabs
    (tabs)/index.tsx      Home
    (tabs)/chat.tsx       AI Chat
    (tabs)/letters.tsx    Letters list
    (tabs)/habits.tsx     Habits + missions + focus entry
    (tabs)/profile.tsx    Settings
    letters/new.tsx       compose (modal)
    letters/[id].tsx      read / sealed view
    focus.tsx             focus session (modal)
    court.tsx             Future Court weekly recap
  components/ui/          design-system primitives (Text, Button, Card, Chip, …)
  components/             feature components (MissionRow, LetterCard, ChatBubble, …)
  theme/                  tokens: color, type, spacing, radius, motion
  domain/                 pure TypeScript: types, streaks, recap scoring, letter rules, dates
                          (no React or React Native imports, so it is unit-tested directly)
  data/                   repository interface + mock implementation + React store
```

**Data access boundary.** Screens talk to `useStore()`, which wraps a `Repository` interface.
Stage 1 ships `MockRepository` (seeded, in memory). Stage 2 adds `SupabaseRepository` with the
same interface, so screens do not change. Mock mode is labelled **"Preview data"** in the UI,
so demo numbers are never presented as real.

**Server-side responsibilities** (never trusted to the client):

| Operation | Where |
|---|---|
| Claude calls, prompt assembly, safety guardrails | Edge Function `chat` |
| AI rate/usage limits | `ai_usage` table + `consume_ai_quota()` SQL function (atomic) |
| Letter readability | RLS on `letter_contents` (`deliver_at <= now()`) |
| Delivery scheduling and push dispatch | `scheduled_deliveries` outbox + `pg_cron` → Edge Function `dispatch` |
| Weekly recap generation | Edge Function `weekly-recap` (computes stats in SQL; AI writes only the jokes) |
| Data export / account deletion | Edge Functions `export-data`, `delete-account` (service role) |

## 4. Navigation

```
Root Stack
├── (tabs)
│   ├── Home      — future-self message, today's missions, next letter, progress, next action
│   ├── Chat      — personality switcher, history, composer
│   ├── Letters   — Sealed / Delivered segments → letters/[id], "Write" → letters/new
│   ├── Habits    — goals, today's missions, streaks, focus entry, Future Court entry
│   └── Profile   — personality, language, notifications, time zone, privacy, data, account
├── letters/new   (modal)
├── letters/[id]
├── focus         (full-screen modal)
└── court         (Future Court recap)
Auth group (stage 2): (auth)/welcome, (auth)/sign-in, onboarding
```

## 5. Database schema (summary)

The full SQL with RLS is in `supabase/migrations/20261027000000_init.sql`.

| Table | Purpose | Key constraints |
|---|---|---|
| `profiles` | 1:1 with `auth.users`; display name, IANA time zone, locale | PK = `auth.users.id`, cascade delete |
| `user_preferences` | personality, notification toggles, quiet hours, privacy flags | PK = user id |
| `user_context_facts` | facts the user **approved** for the AI to remember | user-owned, deletable |
| `conversations` / `messages` | chat history; `messages.role` ∈ user/assistant | messages are inserted by the server only |
| `goals` | user goals (title, why, color, archived) | |
| `missions` | recurring daily missions, optionally linked to a goal; `days_of_week` mask | |
| `mission_completions` | one row per mission per **local date** | `unique(mission_id, local_date)` |
| `focus_sessions` | started/ended timestamps, planned/actual minutes | ended ≥ started |
| `letters` | metadata: title, `deliver_at` (UTC), `delivery_timezone`, status | `deliver_at > created_at` |
| `letter_contents` | the letter body, readable only once delivered | RLS checks the parent's `deliver_at` |
| `push_tokens` | Expo push tokens per device | `unique(token)` |
| `scheduled_deliveries` | outbox: kind, source id, `send_at`, status, attempts, `next_attempt_at`, ticket/receipt ids | `unique(kind, source_id)` = idempotency |
| `weekly_recaps` | stored recap for each ISO week: stats JSON (computed) + copy JSON (AI) | `unique(user_id, week_start)` |
| `ai_usage` | per-user, per-day message and token counters | `unique(user_id, day)` |

RLS is enabled on every table. Default policy is `user_id = auth.uid()`. Tables that only the
server writes (`messages` from the assistant, `scheduled_deliveries`, `weekly_recaps`,
`ai_usage`) give clients `select` access at most.

## 6. Scheduling and push design

1. Creating a letter (or reminder) inserts `letters` + `letter_contents` + one
   `scheduled_deliveries` row in a single RPC (`create_letter`). The client sends a local date and
   time plus an IANA zone, and the server converts that to UTC.
2. `pg_cron` runs every minute and calls the `dispatch` Edge Function through `pg_net`, using a
   secret header.
3. `dispatch` claims due rows with `FOR UPDATE SKIP LOCKED` (status `pending` → `sending`,
   `attempts += 1`). This makes concurrent runs safe.
4. It sends through the Expo Push API and stores ticket ids. On success the status becomes
   **`accepted`**, which is *not* the same as delivered. Errors get exponential backoff in
   `next_attempt_at`, up to 6 attempts, then `failed`. `DeviceNotRegistered` deletes the token.
5. A receipts pass (every 15 minutes) checks Expo receipts and sets `delivered_to_provider` or
   `failed`.
6. **Letter readability does not depend on push.** The letter opens when `deliver_at <= now()`,
   whether or not a notification went out. The UI never claims a push was sent unless the row
   says so.
7. If notifications are off or permission is denied, no push row is created. The letter still
   unlocks in-app.
8. Time zone changes: future deliveries keep their absolute UTC instant. The UI shows both
   "your time then" and "your time now" if they differ.

## 7. AI design (stage 3)

- Personalities (sarcastic / supportive / strict / absurd) are system-prompt variants with a shared
  **safety core**. Roast the *behaviour*, never the person. No insults about body, identity,
  health or money. Switch to sincere support when self-harm or crisis cues appear, and show
  crisis resources.
- Context = last N messages + approved `user_context_facts` + factual activity stats from SQL.
  The model is told to cite stats only from the provided block.
- Limits: per-user daily message cap (for example 40 free), max input length, per-minute burst
  limit, max output tokens. All enforced in `consume_ai_quota()` before calling Claude.
- Model choice is decided in stage 3 against current docs and pricing.

## 8. Risks and assumptions

| Risk | Mitigation |
|---|---|
| Node 22.11 default is below SDK 58 minimum | `.nvmrc` → 24; documented |
| No Docker → migration only verified on PGlite with stubbed auth | Install Docker Desktop (or use a hosted dev project) before stage 2; port the RLS checks to pgTAP (`supabase test db`) |
| No iOS simulator | Expo Go on a device, or `npx expo run:android`; EAS dev build for push |
| Push needs a dev build plus APNs/FCM credentials; Expo Go on Android does not support remote push | Stage 4 uses an EAS development build |
| Screen-time data | **Not claimed.** The iOS Screen Time API (FamilyControls) needs an Apple entitlement; Android needs Usage Access permission. Roadmap only. |
| Voice calls | Roadmap only |
| Humor tone drifting into shaming | Safety core prompt, eval set of adversarial prompts, report button on AI messages |
| LLM-invented statistics in recaps | Stats computed in SQL; AI receives them read-only and writes only the jokes; UI labels "how this was scored" |
| Time zone and DST edge cases for "today" | All "local date" maths goes through `domain/dates.ts` using `Intl` with explicit zones; unit tested |
| `create-expo-app` reported 3 high-severity npm advisories | Review `npm audit` before release; do not `--force` |

Assumptions (documented defaults, change freely): English first with i18n-ready strings later;
letters deliver at 09:00 local time on the chosen date; free tier only; 25-minute default focus
session.

## 9. Phased checklist

### Stage 1 — Foundation and core UI (this pass)
- [x] Scaffold Expo SDK 58 + Router + TS strict; pin Node 24
- [x] Design tokens (color, type, spacing, radius), fonts, dark-first theme
- [x] UI primitives with loading, empty, error and success states
- [x] Five tabs + letter compose/detail, focus session, Future Court
- [x] Domain logic: streaks, local dates, letter eligibility, recap scoring (unit tested)
- [x] Mock repository with realistic seeded data, labelled "Preview data"
- [x] Supabase schema + RLS migration (verified on PGlite: 16/16 checks; not yet on real Supabase)
- [x] Typecheck, lint, 35 unit tests, web export, manual web walkthrough of every screen

### Stage 1.5 — Make it fun (done 2026-10-28)
Feedback after stage 1: it worked but didn't excite. The original idea's hook, future you reacting
to what you're about to do, had been lost in the productivity framing.
- [x] "Peşman olacam?": impulse check with verdict, joke regret meter, parallel-universe line,
      skip/did-it outcome (feeds a Future Court award). Rule-based offline; Claude replaces it in stage 3.
- [x] Future-self persona: name, year ("2031-ci ildən"), Online status, shown on Home, Chat, Court
- [x] Azerbaijani-first UI and copy (own month/weekday names; vowel-harmony year suffixes)
- [x] Character-first Home; 3-step onboarding
- [x] Shareable image cards (react-native-view-shot + expo-sharing; text fallback on web)
- [x] Preview data persisted on device (AsyncStorage)
- Not possible: detecting purchases or messages in other apps automatically (OS sandboxing).
  Later: receive shared links from shopping apps via `expo-sharing` payloads.

### Stage 1.6 — Gemini AI + persona settings (done 2026-10-28)
- [x] Gemini (free tier, `gemini-3.5-flash-lite`, overridable via `GEMINI_MODEL`) behind Expo API
      routes `src/app/api/{regret,chat,health}+api.ts`; key in `.env.local`, never in the app bundle
      (verified by grepping the iOS bundle).
- [x] Order: rate limit → validate input → local crisis/danger check (never sent for a joke) →
      Gemini (JSON schema for regret) → validate output → else 503 and the app falls back to
      offline answers, labelled "oflayn cavab".
- [x] Chat sends the last 12 messages plus an approved stats summary (only if "Use my habit
      stats in chat" is on).
- [x] Onboarding choices are no longer editable inline (chat chips, profile fields removed);
      a dedicated "Gələcəkdəki sən" settings screen edits them as a draft with Save.
- Limits: in-memory rate limit (per instance, resets on restart). Production native builds need
  the API deployed (EAS Hosting: `npx expo export -p web && eas deploy`) and the key set there.
- Gemini terms: free tier data may be used to improve Google products and read by reviewers;
  users must be 18+; serving users in the EEA/UK/Switzerland requires the paid tier.

### Stage 2 — Auth and real data (code done 2026-10-28; waiting for the hosted project)
- [x] Hosted free Supabase project chosen (no Docker on this machine); email one-time code sign-in
- [x] Migration `20261028000000_app_fields.sql`: persona/onboarding columns, `regret_checks`
      (only `outcome` editable), client-written chat with ownership checks.
      Verified on PGlite: 8/8 new + 16/16 original checks. Found and fixed: Supabase default
      privileges would have allowed editing a stored verdict.
- [x] `@supabase/supabase-js` (sessions in AsyncStorage), `AuthProvider`, sign-in screen,
      `SupabaseRepository` behind the same interface; preview mode when keys are absent
- [ ] Create the project, apply both migrations, switch the Magic Link email template to `{{ .Token }}`
- [ ] Live test: sign-in, onboarding, every write path, two accounts can't see each other
- [ ] Built-in email allows 2 emails/hour: configure custom SMTP before real users
- [ ] Server-side: verify the user JWT in AI routes, per-user quota (`consume_ai_quota`),
      delete-account and full export functions

### Stage 3 — AI chat
- [ ] Edge Function `chat` (auth check, input validation, quota, Claude call, persistence)
- [ ] Personality prompts + safety core + eval prompts
- [ ] Approved-memory UI ("Remember this?" → `user_context_facts`)

### Stage 4 — Letters and notifications
- [ ] `create_letter` RPC, `scheduled_deliveries`, `pg_cron` dispatch + receipts
- [ ] `expo-notifications` permission flow, token registration, deep link to letter
- [ ] EAS development build; end-to-end push test on devices

### Stage 5 — Future Court and polish
- [ ] `weekly-recap` function (SQL stats + AI copy), shareable image card
- [ ] Data export (JSON) and account deletion functions
- [ ] Accessibility pass (VoiceOver/TalkBack labels, dynamic type), i18n scaffolding

### Later / roadmap
- [ ] RevenueCat subscriptions
- [ ] Voice calls with future self
- [ ] Digital wellbeing integrations (only behind real OS permissions)
