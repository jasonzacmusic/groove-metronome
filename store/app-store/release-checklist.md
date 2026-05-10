# Groove Metronome iOS/iPad Release Checklist

## Done In Repo

- Web build passes.
- iOS simulator build passes with `CODE_SIGNING_ALLOWED=NO`.
- iPhone and iPad target families are enabled in the Xcode project.
- App icon asset exists at 1024 x 1024.
- Public privacy policy page exists at `/privacy.html`.
- Microphone usage description is present in `ios/App/App/Info.plist`.
- App Store metadata draft is in `store/app-store/metadata.md`.

## App Store Connect Steps

1. Confirm the final bundle ID before creating the App Store record.
   - Current project bundle ID: `com.groovelab.metronome`.
   - Cleaner NSM bundle ID if no App Store record exists yet: `com.nathanielschool.groovemetronome`.
2. In Apple Developer, create or confirm the App ID and capabilities.
3. In App Store Connect, create the iOS app record.
4. Set pricing to Free for version 1.0.
5. Add metadata from `store/app-store/metadata.md`.
6. Add privacy details. Current 1.0 answer should be "Data Not Collected" if no analytics/account/cloud sync is added before submission.
7. Upload screenshots from the Downloads App Store kit.
8. In Xcode, select the correct Apple team and archive for "Any iOS Device".
9. Upload the archive with Xcode Organizer.
10. Submit for TestFlight first, then App Review after a real-device iPhone/iPad smoke test.

## Gig-Safe Smoke Test

- Airplane mode: app loads, core metronome works.
- iPhone portrait: metronome wheel, BPM, time signature, accents, sound, and stage controls are reachable.
- iPad landscape: main metronome and Setlist Studio are readable from music-stand distance.
- Spacebar/tap controls stop immediately on an external keyboard.
- Setlist Studio lock mode prevents accidental edits.
- Analyzer does not change the main tempo until the user explicitly applies it.

## Monetization Later

- Free launch is safest for 1.0.
- Paid app price can be changed or scheduled in App Store Connect.
- Premium digital features inside iOS should use StoreKit in-app purchases/subscriptions.
- Backend flags can keep the app live and coordinate access, but they should not bypass Apple's purchase system for iOS digital unlocks.
