// Expo config plugin stub — wires the Android QS Tile and iOS AppIntents.
// See README.md. Fleshed out in Fase 2 native work.
const { withAndroidManifest, withInfoPlist } = require('expo/config-plugins');

const withQuickSettingsTile = (config) => {
  let next = withAndroidManifest(config, (mod) => {
    const app = mod.modResults.manifest.application?.[0];
    if (!app) return mod;
    app.service ??= [];
    if (!app.service.find((s) => s.$['android:name'] === '.QuickRecordTileService')) {
      app.service.push({
        $: {
          'android:name': '.QuickRecordTileService',
          'android:label': '@string/app_name',
          'android:icon': '@mipmap/ic_launcher',
          'android:permission': 'android.permission.BIND_QUICK_SETTINGS_TILE',
          'android:exported': 'true',
        },
        'intent-filter': [
          { action: [{ $: { 'android:name': 'android.service.quicksettings.action.QS_TILE' } }] },
        ],
      });
    }
    return mod;
  });

  next = withInfoPlist(next, (mod) => {
    mod.modResults.NSSiriUsageDescription ??= 'Permitir Gravador iniciar gravações via Siri?';
    return mod;
  });

  return next;
};

module.exports = withQuickSettingsTile;
