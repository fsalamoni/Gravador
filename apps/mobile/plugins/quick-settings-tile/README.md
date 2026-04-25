# quick-settings-tile (Expo config plugin)

Adds a Quick Settings tile on Android and keeps iOS Siri/AppIntents metadata
ready so users can trigger recording flows from outside the app.

Implementation is injected into native projects at `expo prebuild` time.

## Android

Registers a `TileService` in `AndroidManifest.xml` and generates
`QuickRecordTileService.kt` in the Android source tree. The tile emits
`gravador://?quickAction=start|stop` deep links with a nonce parameter. The
app consumes this in `app/index.tsx` and applies start/stop/toggle on the
shared recorder flow.

## iOS

Sets `NSSiriUsageDescription` in Info.plist. A full AppIntents/WidgetKit target
can be layered later with `expo-apple-targets` when iOS quick actions move to
native extension scope.

See [lodev09/expo-recorder](https://github.com/lodev09/expo-recorder) and
[BasedHardware/omi](https://github.com/BasedHardware/omi) for reference
implementations of both platforms.
