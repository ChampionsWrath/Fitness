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

## Privacy and backup

When the app runs inside the claude.ai artifact viewer it mirrors workouts, weights, food, steps and settings to that artifact's private document store (`src/sync/`), so Safari clearing the embedded page's storage does not lose anything. Photos are not mirrored. On any other host the sync engine is off and everything stays in the browser; `src/sync/backend.ts` is the interface to implement for another cloud store.

Weights, workouts and photos never leave the phone otherwise. Use **Settings → Export backup** to save a JSON copy before changing phones (photos are not included in the export yet).

This app is not medical advice.
