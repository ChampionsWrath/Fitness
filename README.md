# Transformation — 18-month fitness PWA

A mobile-first progressive web app for following an 18-month body-transformation program at home with a treadmill and dumbbells. Everything is stored on the device (IndexedDB); no account or server is required.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173 (also reachable on your LAN for phone testing)
```

Other scripts:

| Script | What it does |
| --- | --- |
| `npm run build` | Type-check and build the production PWA into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Unit tests (Vitest): program schedule, overload logic, stats, data integrity |
| `npm run test:e2e` | Playwright end-to-end run of the full user flow at iPhone size (`PW_CHROMIUM=/path/to/chrome` to reuse an installed browser) |

To host under a sub-folder (e.g. `https://example.com/fitness/`) build with `BASE_PATH=/fitness/ npm run build`.

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`, which tests, builds and publishes the app to GitHub Pages at `https://<your-user>.github.io/<repo>/`. One-time setup: in the repository settings open **Pages** and set *Build and deployment → Source* to **GitHub Actions**. (GitHub Pages on a free account requires the repository to be public; the app contains no secrets or personal data.)

## Install on iPhone

1. Deploy `dist/` to any static host over HTTPS (Cloudflare Pages, Netlify, Vercel, GitHub Pages).
2. Open the URL in **Safari** on the iPhone.
3. Tap the **Share** button, then **Add to Home Screen**.
4. Launch it from the Home Screen. It runs full-screen, works offline, and keeps its data between launches.

For a quick test on your phone without deploying, run `npm run dev` and open the LAN URL Vite prints (both devices must be on the same Wi-Fi). Add-to-Home-Screen also works from there, but offline caching needs the production build.

## Structure

```
src/
  types.ts            Data models (UserProfile, Exercise, WorkoutPlan, WorkoutSession, ExerciseSet, WeightEntry, WaistEntry, ProgressPhoto, Phase …)
  data/exercises.ts   Exercise library: plain-English instructions, mistakes, muscles, alternatives, equipment
  data/program.ts     Phases, weekly schedules, workout plans, equipment substitution
  data/treadmill.ts   Walk-to-5K progression and every guided treadmill / circuit block
  figures/            SVG stick-figure animation engine + one pose set per exercise
  lib/                Schedule maths, progressive-overload recommendations, 7-day trend stats, timers
  db/                 Dexie (IndexedDB) schema and repository functions; every record carries updatedAt for future sync
  screens/            Onboarding, Home, Workout, Active workout, Interval guide, Progress, Weight, Photos, History, Library, Settings
```

Adding Phase 2/3 programming means editing `data/program.ts` only: add plans to `PLANS` and point the phase `schedule` at them.

## Cloud backup setup

Cloud backup is off by default — the app is fully usable with no account, everything stored only in this browser's IndexedDB. To turn it on (recommended, so a lost/wiped phone doesn't lose your data):

1. Create a free project at [supabase.com](https://supabase.com) (no credit card required at this scale).
2. In the new project, open **SQL Editor → New query**, paste in the contents of [`supabase/schema.sql`](supabase/schema.sql), and run it. This creates one table (`sync_docs`) and a Row Level Security policy that keeps each signed-in user's rows visible only to them — that policy is the actual security boundary, not secrecy of any key.
3. In **Project Settings → API**, copy the **Project URL** and the **anon public** key (not the `service_role` key — never put that one in client code).
4. Paste those two values into `src/sync/supabaseConfig.ts` (`SUPABASE_URL` and `SUPABASE_ANON_KEY`). This file is safe to commit — the anon key is meant to be public; Supabase's default new-project setting requires email confirmation on sign-up, which you can turn off in **Authentication → Providers → Email** for a single-user app if you don't want the extra step.
5. Commit, push, redeploy. The app will now show a sign-in screen (email + password) before onboarding — create an account there. Every workout, weigh-in, food entry and step count then backs up automatically, and the Home screen's backup line shows `Backup on` once a write is verified.

Photos are never uploaded (too large for this to be worth it) — they stay device-local, same as before.

## Privacy and backup

With cloud backup configured (above), the app mirrors workouts, weights, food, steps and settings to your own Supabase project (`src/sync/`), scoped to your account, so clearing Safari's local data or losing the phone doesn't lose anything. Without it, everything stays in the browser only; `src/sync/backend.ts` is the interface to implement for a different cloud store.

Either way, use **Settings → Copy backup** (clipboard) or **Export backup** (JSON file) as an extra manual safety net before changing phones — photos aren't included in either backup yet.

This app is not medical advice.
