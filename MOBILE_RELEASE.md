# Mobile Release Notes

The metronome UI and audio engine are shared React/Tone code. Changes shipped to
the public web app are therefore the same changes that Capacitor will package for
iPhone, iPad, and Android.

## Current State

- Capacitor config is present.
- Native `ios/` and `android/` shells are committed and can be synced from the
  shared web build.
- The iOS project includes a native watchOS target: `GrooveWatch Watch App`.
- Native haptic pulse is wired through Capacitor Haptics, with a browser
  vibration fallback where supported.
- App Store deployment still requires Apple signing, an App Store Connect app,
  and a TestFlight/App Store upload from Xcode or CI.

## Sync Flow

```bash
pnpm build
pnpm mobile:sync
```

For local iOS work after the native shell exists:

```bash
pnpm mobile:ios
```

Android build check:

```bash
pnpm mobile:android:build
```

Android builds require a local Java runtime. If Gradle says "Unable to locate a
Java Runtime", install a current JDK and rerun the command.

Watch build check:

```bash
xcodebuild -project ios/App/App.xcodeproj \
  -scheme "GrooveWatch Watch App" \
  -destination "generic/platform=watchOS Simulator" \
  CODE_SIGNING_ALLOWED=NO build
```

## Seamless Deployment Target

For every production change:

1. Push `main` to GitHub.
2. Deploy Vercel for the public web app.
3. Run Capacitor sync to copy the same built assets into the native shells.
4. Archive and upload the iOS build through Xcode or CI with App Store Connect
   credentials.

The first two steps are automated in this repo workflow now. Step 3 is scripted.
Step 4 needs the Apple developer account and signing setup before it can be fully
automated.

## Apple Watch Design

The watch target is a native SwiftUI companion focused on fast practice use:

- Digital Crown BPM control.
- Large tempo readout with classical tempo word.
- Circular beat visualizer.
- Play/stop plus ±1 BPM controls.
- Watch haptic pulses with a stronger downbeat feel.

The next Apple-only integration step is pairing live iPhone state to the watch
with WatchConnectivity after signing is configured in Xcode.
