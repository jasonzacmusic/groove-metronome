# Mobile Release Notes

The metronome UI and audio engine are shared React/Tone code. Changes shipped to
the public web app are therefore the same changes that Capacitor will package for
iPhone, iPad, and Android.

## Current State

- Capacitor config is present.
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
