# Future Roast

A humorous AI companion that acts as your future self: chat with it, seal letters that open on a
future date, track tiny daily missions, and face Future Court every week.

**Status: stage 1.6.** The UI is complete, in Azerbaijani, and runs on **preview data** (seeded,
saved on the device, labelled in the app). AI answers come from Gemini when a key is set (see
below). Accounts and push notifications come in later stages. See [`docs/PLAN.md`](docs/PLAN.md) for the architecture, schema, risks and checklist.

## Requirements

- Node **24** (`nvm use`). Expo SDK 58 needs Node ≥ 22.13; Node 22.11 will warn and may break Metro.
- For native: Expo Go on a phone, or Android Studio / Xcode for a development build.

## Run

```bash
nvm use
npm install
npx expo start        # press i / a / w, or scan the QR code with Expo Go
```

## AI (Gemini)

1. Create a free key at https://aistudio.google.com/apikey
2. `cp .env.example .env.local` and set `GEMINI_API_KEY=...` (the file is git-ignored)
3. Restart `npx expo start`, then check http://localhost:8081/api/health → `{"ai":true}`

Without a key the app still works with offline answers, labelled as such.

## Checks

```bash
npm run typecheck     # tsc --noEmit
npm run lint          # expo lint
npm test              # jest (domain logic + preview repository)
```

## Layout

| Path | What lives there |
|---|---|
| `src/app/` | Expo Router routes only (tabs, letters, goals/missions, focus, court) |
| `src/components/ui/` | Design-system primitives: Text, Button, Card, Chip, Form, Feedback, Icon |
| `src/theme/tokens.ts` | Colors, type scale, spacing, radius, motion |
| `src/domain/` | Pure logic: dates/time zones, streaks, letter rules, Future Court scoring |
| `src/data/` | `Repository` interface, preview implementation, React store, selectors |
| `supabase/migrations/` | Postgres schema with RLS (stage 2 wires it up) |
