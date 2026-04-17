# quick-settings-tile (Expo config plugin)

Adds a Quick Settings tile on Android and a `WidgetKit` + `AppIntents`
bundle on iOS so users can start a recording from outside the app.

Implementation lives here (stubbed for now) and is injected into the native
projects at `expo prebuild` time.

## Android

Registers a `TileService` in `AndroidManifest.xml` that launches the
`gravador://record/start` deep link. The app handles the deep link in
`app/_layout.tsx` and immediately invokes `start()` on the recorder.

## iOS

Creates an `AppIntents` target that implements `StartRecordingIntent`
(conforming to `AudioStartingIntent`). Siri and the Lock Screen widget can
invoke it. Pair with `expo-apple-targets` to build the WidgetKit extension.

See [lodev09/expo-recorder](https://github.com/lodev09/expo-recorder) and
[BasedHardware/omi](https://github.com/BasedHardware/omi) for reference
implementations of both platforms.
