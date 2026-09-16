import 'package:flutter/services.dart';

import '../models/monitored_app.dart';

class MonitoredAppsBridge {
  static const _methodChannel = MethodChannel('mcf/monitored_apps');

  List<MonitoredApp> _decode(List<dynamic>? raw) {
    return (raw ?? [])
        .map((r) => r as Map)
        .map(
          (r) => MonitoredApp(
            packageName: r['packageName'] as String,
            displayName: r['displayName'] as String,
            enabled: r['enabled'] as bool? ?? false,
          ),
        )
        .toList();
  }

  Future<List<MonitoredApp>> getMonitoredApps() async {
    final result = await _methodChannel.invokeMethod<List<dynamic>>(
      'getMonitoredApps',
    );
    return _decode(result);
  }

  /// Apps instaladas en el teléfono que todavía no están en la lista
  /// monitoreada, para elegir cuál agregar.
  Future<List<MonitoredApp>> getInstallableApps() async {
    final result = await _methodChannel.invokeMethod<List<dynamic>>(
      'getInstallableApps',
    );
    return _decode(result);
  }

  Future<void> setAppEnabled(String packageName, bool enabled) {
    return _methodChannel.invokeMethod('setAppEnabled', {
      'packageName': packageName,
      'enabled': enabled,
    });
  }

  Future<List<MonitoredApp>> addMonitoredApp(String packageName) async {
    final result = await _methodChannel.invokeMethod<List<dynamic>>(
      'addMonitoredApp',
      {'packageName': packageName},
    );
    return _decode(result);
  }

  Future<List<MonitoredApp>> removeMonitoredApp(String packageName) async {
    final result = await _methodChannel.invokeMethod<List<dynamic>>(
      'removeMonitoredApp',
      {'packageName': packageName},
    );
    return _decode(result);
  }
}
