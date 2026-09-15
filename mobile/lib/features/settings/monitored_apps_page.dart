import 'package:flutter/material.dart';

import '../../models/monitored_app.dart';
import '../../services/monitored_apps_bridge.dart';
import 'add_monitored_app_page.dart';

class MonitoredAppsPage extends StatefulWidget {
  const MonitoredAppsPage({super.key});

  @override
  State<MonitoredAppsPage> createState() => _MonitoredAppsPageState();
}

class _MonitoredAppsPageState extends State<MonitoredAppsPage> {
  final _bridge = MonitoredAppsBridge();
  List<MonitoredApp> _apps = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final apps = await _bridge.getMonitoredApps();
    if (!mounted) return;
    setState(() {
      _apps = apps;
      _loading = false;
    });
  }

  Future<void> _toggle(MonitoredApp app, bool enabled) async {
    setState(() {
      _apps = [
        for (final a in _apps)
          if (a.packageName == app.packageName) a.copyWith(enabled: enabled) else a,
      ];
    });
    await _bridge.setAppEnabled(app.packageName, enabled);
  }

  Future<void> _remove(MonitoredApp app) async {
    final apps = await _bridge.removeMonitoredApp(app.packageName);
    if (mounted) setState(() => _apps = apps);
  }

  Future<void> _openAddPage() async {
    final added = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const AddMonitoredAppPage()),
    );
    if (added == true) _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Apps monitoreadas')),
      floatingActionButton: FloatingActionButton(
        onPressed: _openAddPage,
        tooltip: 'Agregar app',
        child: const Icon(Icons.add),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              children: [
                if (_apps.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                    child: Text('Ninguna. Toca + para agregar una app.'),
                  ),
                for (final app in _apps)
                  SwitchListTile(
                    title: Text(app.displayName),
                    subtitle: Text(app.packageName),
                    value: app.enabled,
                    onChanged: (value) => _toggle(app, value),
                    secondary: IconButton(
                      icon: const Icon(Icons.delete_outline),
                      tooltip: 'Quitar',
                      onPressed: () => _remove(app),
                    ),
                  ),
              ],
            ),
    );
  }
}
