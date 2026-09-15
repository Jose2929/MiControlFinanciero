import 'package:flutter/material.dart';

import '../notifications/notification_debug_page.dart';
import '../webview/pwa_webview_page.dart';

/// Fase 8.5: pantalla principal tras iniciar sesión — dos pestañas, la PWA
/// completa (wrapper) y la lista de notificaciones/debug ya existente
/// (Fases 2-7). `IndexedStack` mantiene ambas vivas al cambiar de pestaña
/// (el WebView no recarga, la lista de eventos capturados no se pierde).
class HomeShell extends StatefulWidget {
  final int initialIndex;

  const HomeShell({super.key, this.initialIndex = 0});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  late int _index = widget.initialIndex;

  static const _pages = [PwaWebViewPage(), NotificationDebugPage()];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _index, children: _pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (index) => setState(() => _index = index),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.web), label: 'App'),
          NavigationDestination(
            icon: Icon(Icons.notifications),
            label: 'Notificaciones',
          ),
        ],
      ),
    );
  }
}
