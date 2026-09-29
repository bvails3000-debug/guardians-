# Publishing Guardians to the App Store and Google Play

The app is already set up as native iOS (`ios/`) and Android (`android/`) projects using
[Capacitor](https://capacitorjs.com). The same web code runs inside both apps, fully offline.
This guide covers the parts that need **your** accounts, keys and a Mac.

| | Apple App Store | Google Play |
|---|---|---|
| Account | [Apple Developer Program](https://developer.apple.com/programs/) — $99/year | [Play Console](https://play.google.com/console/signup) — $25 one-time |
| Build machine | A Mac with the latest Xcode (required by Apple) | Any computer with Android Studio, or the GitHub Actions workflow |
| Upload format | Archive uploaded from Xcode | `.aab` bundle |
| Review time | Usually 1–3 days | Usually 1–7 days. New personal accounts must first run a closed test with at least 12 testers for 14 days. |

---

## 1. One-time setup

1. **Choose your app ID.** The projects use `com.guardiansfitness.app`. If you own a domain, use it
   reversed (for example `com.yourname.guardians`). Change it **before your first upload**, because it can't be changed afterwards:
   - `capacitor.config.json` → `appId`
   - `android/app/build.gradle` → `namespace` and `applicationId`, then move
     `android/app/src/main/java/com/guardiansfitness/app/MainActivity.java` to the matching folder and update its `package` line
   - In Xcode: *App target → Signing & Capabilities → Bundle Identifier*
2. **Check the name.** "Guardians" may already be taken in the stores. The store listing name can differ
   from the name under the icon (for example listing name "Guardians: Military Fitness PT").
3. **Host the privacy policy.** Both stores need a public URL. The simplest option is to turn on GitHub Pages for this
   repository (*Settings → Pages → Deploy from branch*). The policy will then be at
   `https://<your-username>.github.io/guardians-/privacy.html`, and the full web version of the app at the same address.
   Add a contact email to `privacy.html` before publishing.
4. **Install the tools:** Node 22+, then `npm install` in the project folder.

## 2. Build commands

```bash
npm install          # first time only
npm run cap:sync     # copy the latest web code into ios/ and android/ (run after every change)
npm run ios          # sync, then open the project in Xcode (Mac only)
npm run android      # sync, then open the project in Android Studio
npm run icons        # regenerate all icons/splash screens from the design in scripts/make-icons.mjs
```

---

## 3. Apple App Store

1. Join the Apple Developer Program and sign in to Xcode (*Xcode → Settings → Accounts*).
2. Run `npm run ios`. In Xcode, select the **App** target → **Signing & Capabilities** → choose your Team and
   set the Bundle Identifier.
3. Test on a real iPhone: plug it in, select it at the top of Xcode, and press ▶.
4. Create the app in [App Store Connect](https://appstoreconnect.apple.com) → **My Apps → +**, using the same bundle ID.
5. In Xcode, set the device to **Any iOS Device (arm64)**, then choose **Product → Archive**. When it finishes,
   choose **Distribute App → App Store Connect → Upload**.
6. Optional: use **TestFlight** in App Store Connect to install the build on your own phone and on testers' phones.
7. Fill in the listing (section 5), upload screenshots (section 6), then **Submit for Review**.

**App Privacy answers:** *Data Not Collected.* Everything is stored only on the device.
**Export compliance:** already answered in `Info.plist` (`ITSAppUsesNonExemptEncryption = NO`).
**Devices:** the project is set to **iPhone only** (it still runs on iPad in iPhone mode), so only iPhone screenshots are needed.

## 4. Google Play

1. **Create an upload key** once and back it up somewhere safe. If you lose it you need to go through Google support to reset it.
   ```bash
   keytool -genkey -v -keystore guardians-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
   ```
2. **Build the signed bundle.** Either:
   - **With GitHub Actions (no local setup):** go to the repository's *Settings → Secrets and variables → Actions* and add
     `ANDROID_KEYSTORE_BASE64` (the output of `base64 -w0 guardians-upload.jks`), `ANDROID_KEYSTORE_PASSWORD`,
     `ANDROID_KEY_ALIAS` (`upload`) and `ANDROID_KEY_PASSWORD`. Each push then produces a
     **guardians-android-release-aab** artifact on the workflow run page. Each run also produces a debug APK you can install
     directly on an Android phone for testing.
   - **Or locally:** set those same four variables in your terminal (with `ANDROID_KEYSTORE_FILE` pointing at the `.jks` file instead of
     the base64 one), then run `npm run cap:sync && cd android && ./gradlew bundleRelease`.
     The file lands in `android/app/build/outputs/bundle/release/`.
3. In the [Play Console](https://play.google.com/console), choose **Create app**, then work through the *Set up your app* checklist:
   - **Privacy policy:** your hosted `privacy.html` URL
   - **Data safety:** "No data collected" and "No data shared"
   - **Ads:** No. **Target audience:** 18+ (or 17+). **Content rating questionnaire:** a fitness app with no user interaction
   - **Health apps declaration:** fitness/training, not a medical device
4. Upload the `.aab` under **Testing → Closed testing**. (New personal developer accounts need 12+ testers for 14 days
   before they can publish to Production.) After that, promote the build to **Production**.
5. Every new upload needs a higher version code. The CI workflow uses the run number automatically; for local builds, set
   `ANDROID_VERSION_CODE`.

---

## 5. Store listing text (ready to paste)

**Name:** Guardians: Military Fitness PT
**Subtitle (Apple, 30 characters):** Train for your military PT test
**Short description (Google, 80 characters):** Adaptive training plans for every military fitness test and special ops screener.
**Category:** Health & Fitness
**Keywords (Apple, 100 characters):** ACFT,AFT,PFT,CFT,PRT,PST,military,fitness test,army,marines,navy,air force,SEAL,ranger,workout

**Description:**

> Train for the fitness test that stands between you and the job you want.
>
> Guardians builds a day-by-day training plan from your current numbers and adapts it every day based on your training diary.
>
> EVERY BRANCH, EVERY TEST
> • Army Fitness Test (AFT), plus Ranger and Special Forces screening events
> • Marine Corps PFT and CFT, plus MARSOC and Recon screening events
> • Navy PRT, plus SEAL, SWCC, EOD/Diver and AIRR Physical Screening Tests
> • Air Force and Space Force PFA, plus Special Warfare PAST (PJ, CCT, SR, TACP, SERE)
> • Coast Guard fitness test and Rescue Swimmer (AST) screening
>
> KNOW YOUR TARGET
> Pick your job (11B, 0311, SEAL, Pararescue and 70+ more) and see the minimum score to qualify and the score that makes you competitive, broken down into exact reps and times for every event.
>
> A PLAN BUILT FROM YOUR NUMBERS
> Enter your current stats (the app shows you how to test each event) and get a periodized plan to test day: Base, Build, Peak and Taper phases, goal-pace intervals, swim splits, ruck progressions and regular mock tests.
>
> A DIARY THAT ADAPTS
> Log how each day went. Bad day? The next session is scaled back. Sick? Rest first. Shin or knee pain? Running is swapped for low-impact work. Stringing together strong days? Volume goes up. You can see exactly what changed and why.
>
> PRIVATE BY DESIGN
> No account, no ads, no tracking. Your data never leaves your phone. Works completely offline.
>
> Guardians is an independent training tool and is not affiliated with or endorsed by the U.S. Department of Defense, Department of Homeland Security or any military branch. Scores are estimates. Always confirm current standards with your recruiter or unit.

**Notes for App Review (Apple):**

> Guardians is a fully offline fitness training app with no accounts or servers. To test it, complete the short setup (any age 17+, any branch, then pick a job such as "11B" or "SEAL"). You can leave the stats blank. The Diary tab shows the adaptive plan: log a day with low energy or a pain area and the next session updates. Daily reminders are local notifications (Settings → Daily reminder).

## 6. Screenshots

- **Apple:** at least one set of 6.9-inch iPhone screenshots (1320 × 2868 or 1290 × 2796).
- **Google:** at least 2 phone screenshots, plus a 512 × 512 icon (`icons/icon-512.png`) and a 1024 × 500 feature graphic.

Good screens to capture: the Today dashboard, the job requirements table, the weekly plan, the "Your plan adapted" message
in the Diary, and Progress. Take them in the iOS Simulator (*File → Save Screen*) or on your phone.

## 7. Review risks, and how the app addresses them

- **"Just a website" rejection (Apple guideline 4.2):** the app is fully offline, keeps its data in native storage and sends
  native local-notification reminders tied to the adaptive plan. Mention the offline use and reminders in the review notes.
- **Military branding:** don't use official seals, insignia or "Official" wording anywhere. The listing includes a
  non-affiliation disclaimer.
- **Health claims:** the app presents scores as estimates and advises seeing a medical professional, both in Settings and
  in the privacy policy. Keep that wording in the listing.
