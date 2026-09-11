# Transformation — fitness app + custom wristband

## What this is
A mobile-first fitness/nutrition PWA (React + TypeScript + Vite + Dexie/IndexedDB),
originally built and iterated inside a claude.ai Artifact. The Artifact caused
repeated silent data loss (its cloud "db" capability accepted writes that never
actually persisted) — **do not use any claude.ai artifact as a data store again.**
The durable home for this app is this GitHub repo, deployed to GitHub Pages, opened
in real Safari/Chrome so browser storage is first-party and permanent.

## Current state of the software (already built, verify on import)
- Full 18-month workout program (3 phases), exercise library with SVG demo
  animations, progressive-overload suggestions, rest timer.
- Food/calorie tracker: built-in food database, daily + weekly targets from
  Mifflin-St Jeor, macro tracking.
- Steps: manual daily entry (typed in from Pedometer++ today), credited as
  calories burned above an activity baseline.
- Workout calorie burn: per-exercise MET-based estimate for lifting (uses real
  time between completed sets), ACSM-equation estimate for treadmill work from
  distance/incline/minutes entered from the machine's display. Both netted
  against food intake.
- Weight/waist tracking with trend charts, progress photos (local only, not
  synced), workout history.
- Data layer: Dexie (IndexedDB) — see `src/types.ts` for the full schema and
  `src/db/repo.ts` for repo functions. A `src/sync/` engine existed for the
  now-abandoned artifact backend; keep the interface (`SyncBackend` in
  `src/sync/backend.ts`) since we may want a real remote backend later, but the
  claude.ai artifact implementation (`src/sync/claudeBackend.ts`) is dead code
  now that we're off the artifact — fine to leave inert, or remove once
  confirmed nothing depends on it.
- Export/import (JSON) and clipboard copy/paste backup exist in Settings as a
  manual safety net — keep these regardless of what else changes.

## The goal right now
Get this onto the user's iPhone as a real, permanently-installed app, and build
a custom BLE wristband from scratch that feeds step count, heart rate, HRV, and
sleep data into this app's own data layer. No HealthKit, no App Store, no
third-party wearable APIs or vendor sensor-fusion chips — the user is
deliberately writing their own signal processing as a learning project. One
device, one user (the repo owner), personal use only.

## App distribution plan
1. **Now / near-term:** deploy to GitHub Pages via `.github/workflows/deploy.yml`
   (already in the repo). Open in Safari on iPhone, Add to Home Screen. This is
   the durable baseline and should be treated as done ASAP, independent of the
   hardware work.
2. **Native shell (needed for Bluetooth on iPhone):** iOS Safari has no Web
   Bluetooth API and Apple does not allow other iOS browsers to add it, so the
   band cannot talk to the app in mobile Safari. The plan is to wrap this same
   web app with **Capacitor** (native shell, web code runs unchanged inside a
   webview) and use a Capacitor BLE plugin on iOS.
   - Build the iOS app in CI on **GitHub Actions** (macOS runners), since the
     user has only a Windows laptop and no Mac.
   - **Distribution: sideload via AltStore**, not the Apple Developer Program.
     Free Apple ID, signs on-device via AltServer running on the Windows
     laptop, auto-refreshes over Wi-Fi before the 7-day signing expiry as long
     as AltServer is running periodically. CI should produce an unsigned `.ipa`
     as a downloadable build artifact; AltStore does the signing locally, so no
     Apple credentials/certificates need to live in CI secrets and the repo can
     stay public.
   - **Do NOT set up TestFlight / pay for the Apple Developer Program unless
     the user explicitly asks for it.** It's a valid later upgrade (same
     codebase, add a signed build + TestFlight upload step) but costs $99/yr
     and isn't needed for BLE or any planned feature. If migrated later: old
     sideloaded app and new TestFlight app are signed by different identities,
     so it's delete-old, install-new, restore via the export/import feature —
     not an in-place upgrade. Mention this cost/tradeoff if the user brings it
     up again, but don't push it.
3. **Development:** Web Bluetooth in desktop Chrome (works today, no wrapping
   needed) is the fast iteration loop — build and test the BLE code against the
   web app running on the laptop before touching the iOS shell. Structure BLE
   access behind one interface with two implementations (Web Bluetooth for
   Chrome, Capacitor plugin for iOS) so the same app code drives both.

## Hardware decisions (already made, don't re-litigate without new info)
- **MCU: Seeed XIAO nRF52840 Sense** — already ordered. Nordic nRF52840,
  BLE 5.0, onboard 6-axis IMU (steps + raise-to-wake gesture), onboard LiPo
  charge management, USB-C flashing from Windows via Arduino IDE. Confirmed
  correct for this project. NOTE: the non-Sense XIAO nRF52840 lacks the IMU —
  always double check "Sense" is in the product title before ordering more.
- **Heart rate sensor: MAX30101 or MAX30105, raw chip, own signal processing**
  — NOT the MAX30102 (red+IR only, no green LED; green is what wrist PPG
  needs for motion tolerance) and NOT the SparkFun MAX30101+MAX32664 sensor
  hub board (ships wrong firmware version for a wrist device — Version A is
  finger-only; wrist algorithms B/C need MAX86140/41 sensors instead — and
  reflashing needs a separate programmer + Analog Devices .msbl images. Dead
  end. Confirmed by the user's own research, verified correct.). Buy a
  SparkFun MAX30101 or MAX30105 breakout board (has correct I2C pull-up
  resistors already). Avoid unbranded "MAX30102" modules — some batches have
  pull-ups wired to the wrong voltage rail.
- **Display: Sharp Memory LCD** (Adafruit 1.3" breakout), not OLED. Reflective,
  near-zero static power draw, readable in direct sunlight, SPI interface.
  User explicitly wants and likes **raise-to-wake**: display normally blank,
  IMU fires a wake interrupt on wrist-tilt, MCU wakes and draws the time.
  This is a first-class desired feature, not a fallback for battery reasons.
- **Battery:** 3.7V LiPo, 350–400mAh, must have a built-in protection circuit.
- **Timestamps:** the board has no battery-backed real-time clock, only
  uptime-since-power-on. Protocol: app writes current time to the band on
  every BLE connect (standard "Current Time" BLE service); band stamps
  samples in its own uptime; app converts to real timestamps on receipt.
  Design this in from milestone 2 onward or collected data can't be placed
  in time.

## Data model changes needed for device data (not yet implemented)
Additive only — nothing existing should move or break:
- `StepEntry`: add `source: 'manual' | 'device'` so a device write can
  overwrite a manual one, but a later manual edit still wins (existing
  newer-`updatedAt`-wins merge logic already supports this pattern).
- New table `hrSamples`: one row per minute — `ts`, `bpm`, `quality`. Bucket
  this one **by day** (not by month like other synced tables) if/when it goes
  through any remote sync — a day of per-minute samples can approach the
  256KB single-document limit that applied to the old artifact backend; even
  without that backend, keep the same discipline for whatever comes next.
- New table `dailyVitals`: one row per date — `restingHr`, `hrvRmssd`,
  `sleepStart`, `sleepEnd`, `sleepStages[]`.
- New table `devices`: `id`, `name`, `lastSyncAt`, clock offset.
- `WorkoutSession`: add optional `deviceHr?: { avg, max, samples }`, filled in
  by the app (never the band) after matching HR samples whose timestamps fall
  inside `startTime`–`endTime`.
- Be honest with the user about signal quality in the UI: continuous HR during
  lifting will be noisy for everyone (including commercial trackers); resting
  HR and HRV measured during stillness/sleep will be the reliable numbers.
  Sleep *timing* from wrist stillness is solid; sleep *stages* from wrist data
  alone should be labeled as an estimate, not presented as clinical fact.

## Milestone sequence (smallest first, do not skip ahead)
1. Board alive: blink LED, read IMU over serial monitor, tape to wrist, watch
   step-like spikes. One evening, board + USB-C cable only, no soldering.
2. Board → app over BLE: custom GATT service, advertise, connect from the app
   in desktop Chrome (Web Bluetooth), stream a live step count into
   `StepEntry`. No soldering yet — proves the whole pipeline end to end.
3. Untethered: solder headers + battery, measure runtime, add a battery-level
   BLE characteristic.
4. Raw PPG: wire the MAX30101/105 on breadboard, stream raw light readings,
   plot the waveform on a fingertip. No algorithm yet — just see the pulse.
5. Own heart-rate math: filter, beat detection, BPM + RMSSD (HRV) on the
   finger, then move to wrist and see why green LED / motion tolerance
   matters in practice.
6. Display + enclosure: Sharp Memory LCD, raise-to-wake via IMU interrupt,
   buffer overnight samples in flash, bulk-transfer on connect, compute
   resting HR/HRV from the quietest 5 minutes of the night.
7. Workout linkage + sleep stages: attach HR to sessions by time window, then
   the sleep-stage heuristic (clearly labeled as an estimate in the UI).

## Ground rules for whoever picks this up
- This is an explicit learning project for someone with zero prior electronics
  experience. Explain hardware terms on first use (what a pull-up resistor is,
  what I2C/SPI are, etc.) — don't assume prior knowledge.
- When there's a choice between an easy path (vendor chip does the math) and a
  harder path that teaches more, explain both and recommend the one that
  teaches more, unless the harder path is genuinely unworkable — then say so
  plainly.
- Don't write firmware speculatively ahead of the milestone the user is
  actually on. Smallest-provable-step first.
- Do not touch, reference, or depend on any TheCrucibleMC repository — this
  project is fully independent of that Minecraft server codebase.
