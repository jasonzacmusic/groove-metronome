# Mobile Release Notes

The metronome UI and audio engine are shared React/Tone code. Changes shipped to
the public web app are therefore the same changes that Capacitor will package for
iPhone, iPad, and Android.

## Current State

- Capacitor config is present.
- Native haptic pulse is wired through Capacitor Haptics, with a browser
  vibration fallback where supported.
- Native `ios/` and `android/` shells are not committed yet.
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

## Apple Watch Path

The shared React/Tone app can package for iPhone, iPad, and Android through
Capacitor. Apple Watch needs a native watchOS companion target rather than the
web UI running directly on the watch.

Recommended implementation:

1. Generate and commit the native `ios/` shell.
2. Open the iOS workspace in Xcode and add a watchOS companion app target.
3. Share tempo, meter, pattern, and play/stop state using WatchConnectivity.
4. Trigger watch haptics from the watch target with `WKInterfaceDevice` patterns
   that mirror the phone haptic accents.
5. Keep the phone/web app as the source of truth for presets and playlist data.
