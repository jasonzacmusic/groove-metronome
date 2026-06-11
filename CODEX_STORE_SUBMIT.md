# Codex Task — Submit Groove Metronome 1.0.4 to the App Store and Play Store

You are working on Jason Zac's Mac mini (Apple M4 Pro, macOS Sequoia). Everything is
already built, signed, and waiting. Your job is ONLY the store submission steps that
need a browser login or one missing credential. Do not rebuild anything.

## What is already done (do not redo)

- All bug fixes are committed and pushed to `main` of
  `github.com/jasonzacmusic/groove-metronome`; the web app is live at
  https://metronome.nathanielschool.com
- iOS archive: `~/Documents/Codex/groove-metronome/build/GrooveMetronome-1.0.4-b4.xcarchive`
  (version 1.0.4, build 4, bundle ID `com.groovelab.metronome`, team `R3UNCZH45H`,
  signed with "Apple Distribution: Jason Zachariah").
- Signed App Store IPA: `~/Desktop/Groove Metronome 1.0.4 Release/GrooveMetronome-1.0.4-b4.ipa`
- Signed Play Store bundle: `~/Desktop/Groove Metronome 1.0.4 Release/GrooveMetronome-1.0.4-playstore.aab`
  (versionName 1.0.4, versionCode 3, package `com.groovelab.metronome`, signed with the
  upload keystore at `~/.android-keystores/groove-metronome-upload.keystore`;
  passwords in `~/.android-keystores/groove-metronome-upload.passwords.txt`).
- App Store Connect API key file: `~/.appstoreconnect/private_keys/AuthKey_9BBP996H5K.p8`
  (key ID `9BBP996H5K`). The ONLY missing piece is the Issuer ID, which is on the
  App Store Connect website.
- Store listing copy is in `~/Documents/Codex/groove-metronome/store/app-store/metadata.md`.
- Privacy policy URL: https://metronome.nathanielschool.com/privacy.html
- Privacy answers: the app collects no data ("Data Not Collected"). Mic permission is
  used only for the on-device tempo analyzer; nothing is recorded or sent anywhere.

## Part 1 — iOS (App Store Connect)

1. Sign in to https://appstoreconnect.apple.com with `music@nathanielschool.com`.
2. Go to **Users and Access → Integrations → App Store Connect API** and copy the
   **Issuer ID** at the top of the page.
3. Upload the build from Terminal (the key file is already in place):
   ```bash
   xcrun altool --upload-app -f "$HOME/Desktop/Groove Metronome 1.0.4 Release/GrooveMetronome-1.0.4-b4.ipa" \
     -t ios --apiKey 9BBP996H5K --apiIssuer PASTE_ISSUER_ID_HERE
   ```
   If `altool` complains, fall back to Xcode: open Xcode → Window → Organizer →
   select the "App" archive dated today (1.0.4 build 4) → Distribute App →
   App Store Connect → Upload, all defaults.
4. If NO App Store record exists yet for `com.groovelab.metronome`, create it first:
   App Store Connect → My Apps → "+" → New App → iOS, name **Groove Metronome by NSM**
   (fall back to "NSM Groove Metronome" if taken), bundle ID `com.groovelab.metronome`,
   SKU `groove-metronome-ios`, price Free. Fill the listing from
   `store/app-store/metadata.md`, privacy = Data Not Collected, and the privacy URL above.
5. Once the build finishes processing, add it to TestFlight, then submit version 1.0.4
   for App Review. Release notes:
   "Stage-ready update: switch between Metronome, Analyzer and Setlist freely on iPhone
   and iPad, lockable full-screen stage mode with song navigation, and the click now
   plays reliably even with the silent switch on and after calls or notifications."
6. Save the Issuer ID for next time: append a line
   `ASC_ISSUER_ID=<value>` to `~/.android-keystores/groove-metronome-upload.passwords.txt`.

## Part 2 — Android (Google Play Console)

1. Sign in to https://play.google.com/console with Jason's Google account
   (music@nathanielschool.com). If there is no Play developer account yet, it needs the
   one-time $25 registration — pause and tell Jason before paying.
2. Create the app if it doesn't exist: All apps → Create app → name
   **Groove Metronome by NSM**, default language English, App, Free.
3. Complete the "Set up your app" checklist:
   - Privacy policy: https://metronome.nathanielschool.com/privacy.html
   - App access: all features available without login.
   - Ads: No ads.
   - Content rating questionnaire: Utility/Tools, no objectionable content → Everyone.
   - Target audience: 13+ (not designed for children).
   - Data safety: no data collected, no data shared.
   - Category: Music & Audio. Contact email: music@nathanielschool.com.
4. Store listing text: reuse the copy in `store/app-store/metadata.md` (short
   description ≤ 80 chars, full description ≤ 4000). Screenshots: take phone +
   tablet screenshots from the live site or the APK on the Android emulator;
   1024×500 feature graphic can be exported from the existing brand assets if needed —
   if missing, ask Claude Code to generate one rather than skipping.
5. Production → Create new release → upload
   `~/Desktop/Groove Metronome 1.0.4 Release/GrooveMetronome-1.0.4-playstore.aab`.
   Accept Play App Signing (Google wraps our upload key — correct and expected).
   Release notes: same text as iOS step 5.
6. Roll out to production (or to internal testing first if Jason prefers a check on
   his own phone — the direct-install APK in the same Desktop folder also works for that).

## Guardrails

- Never regenerate or replace `~/.android-keystores/groove-metronome-upload.keystore` —
  losing it would lock us out of Play updates.
- Do not bump version numbers; 1.0.4 (iOS build 4, Android versionCode 3) is final for
  this release.
- If a store rejects over the bundle ID/package name, report back instead of creating
  records under a different ID.
