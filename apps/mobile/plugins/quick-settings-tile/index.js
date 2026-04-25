const fs = require('node:fs');
const path = require('node:path');
const { withAndroidManifest, withDangerousMod, withInfoPlist } = require('expo/config-plugins');

function buildTileServiceSource(packageName) {
  return `package ${packageName}

import android.app.PendingIntent
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService

class QuickRecordTileService : TileService() {
  override fun onStartListening() {
    super.onStartListening()
    val tile = qsTile ?: return
    if (tile.state != Tile.STATE_ACTIVE && tile.state != Tile.STATE_INACTIVE) {
      tile.state = Tile.STATE_INACTIVE
    }
    tile.label = if (tile.state == Tile.STATE_ACTIVE) "Parar gravacao" else "Iniciar gravacao"
    tile.updateTile()
  }

  override fun onClick() {
    super.onClick()

    val tile = qsTile ?: return
    val action = if (tile.state == Tile.STATE_ACTIVE) "stop" else "start"
    launchAction(action)

    tile.state = if (action == "start") Tile.STATE_ACTIVE else Tile.STATE_INACTIVE
    tile.label = if (tile.state == Tile.STATE_ACTIVE) "Parar gravacao" else "Iniciar gravacao"
    tile.updateTile()
  }

  private fun launchAction(action: String) {
    val deepLink = Uri.parse(
      "gravador://?quickAction=$action&quickActionNonce=" + System.currentTimeMillis()
    )
    val intent = Intent(Intent.ACTION_VIEW, deepLink).apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
      addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      val pendingIntent = PendingIntent.getActivity(
        this,
        action.hashCode(),
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
      startActivityAndCollapse(pendingIntent)
      return
    }

    @Suppress("DEPRECATION")
    startActivityAndCollapse(intent)
  }
}
`;
}

function withAndroidTileServiceSource(config) {
  return withDangerousMod(config, [
    'android',
    async (mod) => {
      const packageName = config.android?.package;
      if (!packageName) {
        throw new Error('quick-settings-tile plugin requires android.package in app config');
      }

      const packageDir = packageName.split('.').join(path.sep);
      const destination = path.join(
        mod.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'java',
        packageDir,
        'QuickRecordTileService.kt',
      );

      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, buildTileServiceSource(packageName), 'utf8');

      return mod;
    },
  ]);
}

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

  next = withAndroidTileServiceSource(next);

  next = withInfoPlist(next, (mod) => {
    mod.modResults.NSSiriUsageDescription ??= 'Permitir Gravador iniciar gravações via Siri?';
    return mod;
  });

  return next;
};

module.exports = withQuickSettingsTile;
