import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../../services/notification_bridge.dart';
import '../confirm/confirm_movement_page.dart';
import 'monitored_apps_page.dart';

/// Ajustes de la app: estado del permiso de notificaciones, apps
/// monitoreadas, registro manual de un movimiento, y cerrar sesión.
class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> with WidgetsBindingObserver {
  final _bridge = NotificationBridge();
  bool _accessGranted = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _refreshAccessStatus();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _refreshAccessStatus();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  Future<void> _refreshAccessStatus() async {
    final granted = await _bridge.isNotificationAccessGranted();
    if (mounted) setState(() => _accessGranted = granted);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Ajustes')),
      floatingActionButton: FloatingActionButton.extended(
        icon: const Icon(Icons.add),
        label: const Text('Registrar movimiento'),
        onPressed: () {
          Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => ConfirmMovementPage.manual()),
          );
        },
      ),
      body: ListView(
        children: [
          ListTile(
            leading: Icon(
              _accessGranted ? Icons.check_circle : Icons.error,
              color: _accessGranted ? Colors.green : Colors.red,
            ),
            title: const Text('Acceso a notificaciones'),
            subtitle: Text(_accessGranted ? 'Concedido' : 'No concedido'),
            trailing: _accessGranted
                ? null
                : TextButton(
                    onPressed: _bridge.openNotificationListenerSettings,
                    child: const Text('Activar'),
                  ),
          ),
          const Divider(height: 1),
          ListTile(
            leading: const Icon(Icons.apps),
            title: const Text('Apps monitoreadas'),
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const MonitoredAppsPage()),
            ),
          ),
          const Divider(height: 1),
          ListTile(
            leading: const Icon(Icons.logout),
            title: const Text('Cerrar sesión'),
            onTap: () => FirebaseAuth.instance.signOut(),
          ),
        ],
      ),
    );
  }
}
