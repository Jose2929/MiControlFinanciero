import 'package:flutter/material.dart';

import '../../models/monitored_app.dart';
import '../../services/monitored_apps_bridge.dart';

class AddMonitoredAppPage extends StatefulWidget {
  const AddMonitoredAppPage({super.key});

  @override
  State<AddMonitoredAppPage> createState() => _AddMonitoredAppPageState();
}

class _AddMonitoredAppPageState extends State<AddMonitoredAppPage> {
  final _bridge = MonitoredAppsBridge();
  List<MonitoredApp> _installableApps = [];
  String _query = '';
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final apps = await _bridge.getInstallableApps();
    if (!mounted) return;
    setState(() {
      _installableApps = apps;
      _loading = false;
    });
  }

  Future<void> _select(MonitoredApp app) async {
    await _bridge.addMonitoredApp(app.packageName);
    if (mounted) Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _installableApps
        .where(
          (app) =>
              app.displayName.toLowerCase().contains(_query.toLowerCase()) ||
              app.packageName.toLowerCase().contains(_query.toLowerCase()),
        )
        .toList();

    return Scaffold(
      appBar: AppBar(title: const Text('Agregar app')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: TextField(
                    decoration: const InputDecoration(
                      labelText: 'Buscar app instalada',
                      prefixIcon: Icon(Icons.search),
                      border: OutlineInputBorder(),
                    ),
                    onChanged: (value) => setState(() => _query = value),
                  ),
                ),
                Expanded(
                  child: filtered.isEmpty
                      ? const Center(child: Text('Sin resultados'))
                      : ListView.builder(
                          itemCount: filtered.length,
                          itemBuilder: (context, index) {
                            final app = filtered[index];
                            return ListTile(
                              title: Text(app.displayName),
                              subtitle: Text(app.packageName),
                              onTap: () => _select(app),
                            );
                          },
                        ),
                ),
              ],
            ),
    );
  }
}
