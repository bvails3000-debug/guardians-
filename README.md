# Guardians — Adaptive Military Fitness Coach

An app for **iOS, Android and the web** that trains you for your military fitness test. Pick the job you want,
see the score it takes, enter your current stats, and get a day-by-day plan up to test day. The plan
**adapts to your training diary**: log a bad day, soreness, pain or illness and upcoming sessions change
automatically.

## Features

- **Every branch's test + special-warfare screeners**
  - Army Fitness Test (AFT/ACFT), Army SOF screening (Ranger / Special Forces: RPA events + 12-mile ruck)
  - Marine Corps PFT and CFT, MARSOC Raider screening, Recon screening
  - Navy PRT, SEAL PST, SWCC PST, EOD/Diver PST, AIRR PST
  - Air Force PFA, Special Warfare PAST (PJ/CCT/SR), TACP/SERE PAST
  - Space Force PFA
  - Coast Guard accession PFT, Rescue Swimmer (AST) PFT
- **Job-based targets.** 70+ jobs across all branches (e.g. 11B, 18X, 0311, 0372, SEAL, PJ, AST) with the
  **minimum** score to qualify and a **recommended** competitive score, converted into the exact reps and times you need
  per event. The Army combat-MOS sex-neutral standard is applied automatically.
- **Guided onboarding.** Walks you through entering current stats, with "How to test this" instructions for each event.
  Missing numbers? Day 1 becomes a baseline test.
- **Periodized plan.** Base → Build → Peak → Taper phases, mock tests every 4th week, sessions weighted toward your
  biggest gaps, with paces and loads calculated from your numbers (interval paces, swim per-100 splits, deadlift percentages,
  ruck distances and more).
- **Adaptive diary.** Log completion, effort (RPE), energy, sleep, soreness, mood, pain areas, illness and free-text notes.
  - One bad day → the next session is trimmed ~25% and capped at moderate effort
  - Two or more bad days in a row → mini deload
  - Sick → rest, then easy recovery work
  - Pain → the affected area is avoided (e.g. knee/shin pain swaps running for swimming or other low-impact work)
  - Skipped sessions, poor sleep trends and hot streaks all adjust volume
  - Notes are read too: "exhausted", "knee hurts", "flu" and "new PR" all count
- **Progress tracking.** Estimated score per test, per-event bars against the minimum and your goal, trend sparklines,
  and single-result or full mock-test logging. New results automatically recalibrate the plan.
- **Private and offline.** All data stays on the device (localStorage). It installs to the home screen and works without a
  connection. JSON backup and restore are included.

- **Native iOS and Android apps.** The app is packaged with [Capacitor](https://capacitorjs.com). In the native apps, data is also saved to
  native storage, and optional daily reminders name each day's (adapted) session.

## Running it

```bash
npm install        # installs Capacitor (the web app itself has no runtime dependencies)
npm start          # serves the web app at http://localhost:8080
npm test           # runs the unit tests (node --test)
```

### Phone apps (App Store / Google Play)

```bash
npm run cap:sync   # copy the web app into the native projects (after every change)
npm run ios        # open in Xcode (Mac)
npm run android    # open in Android Studio
```

The GitHub Actions workflow (`.github/workflows/mobile.yml`) runs the tests, builds an installable Android APK, builds a
signed Play Store bundle once signing secrets are added, and compiles the iOS app. **[docs/APP_STORE.md](docs/APP_STORE.md)**
walks through accounts, signing, store listing text, screenshots and review.

### Web / PWA

Host the folder on any static host with HTTPS (for example GitHub Pages), then open it on a phone:
- **iPhone:** Safari → Share → Add to Home Screen
- **Android:** Chrome → menu → Install app

## Project layout

```
index.html, manifest.webmanifest, sw.js   App shell, PWA manifest, offline service worker
css/styles.css                            Mobile-first styles (dark and light)
js/data/tests.js                          All test definitions and standards
js/data/jobs.js                           Jobs → required / recommended scores
js/engine/scoring.js                      Points ⇄ raw values, pass/fail, per-event targets
js/engine/planner.js                      Periodized plan + session prescriptions
js/engine/adapt.js                        Diary analysis → plan adjustments
js/ui/*.js                                Screens (onboarding, today, plan, diary, progress, settings)
tests/engine.test.js                      Unit tests for scoring, planning and adaptation
js/native.js, js/reminders.js             Capacitor bridge (no-op on the web) and daily reminders
privacy.html                              Privacy policy (required by both stores)
scripts/serve.mjs                         Dev server
scripts/build-web.mjs                     Copies the web app into www/ for Capacitor
scripts/make-icons.mjs                    Renders web, iOS and Android icons and splash screens
ios/, android/                            Native projects (Capacitor)
capacitor.config.json                     App ID, name and native plugin config
docs/APP_STORE.md                         Publishing guide
```

## Disclaimer

The official score charts are long age/sex tables that change often. This app models each event using its minimum and
maximum/competitive standards, with an age adjustment, so **scores are estimates for training purposes**. Always confirm
the current standards with your recruiter or unit. Talk to a medical professional before starting a new training program,
and about any pain that doesn't go away.
