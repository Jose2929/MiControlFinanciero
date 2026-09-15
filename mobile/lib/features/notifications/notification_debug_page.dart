import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../models/parsed_transaction.dart';
import '../../models/transaction_type.dart';
import '../../services/notification_bridge.dart';
import '../../services/notification_deduplicator.dart';
import '../../services/parsers/parser_registry.dart';
import '../confirm/confirm_movement_page.dart';
import '../settings/monitored_apps_page.dart';

class NotificationDebugPage extends StatefulWidget {
  const NotificationDebugPage({super.key});

  @override
  State<NotificationDebugPage> createState() => _NotificationDebugPageState();
}

class _NotificationDebugPageState extends State<NotificationDebugPage>
    with WidgetsBindingObserver {
  final _bridge = NotificationBridge();
  final _parserRegistry = ParserRegistry();
  final _deduplicator = NotificationDeduplicator();
  final _events = <(NotificationEvent, ParsedTransaction?)>[];
  bool _accessGranted = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _refreshAccessStatus();
    _bridge.events.listen((event) async {
      final parsed = _parserRegistry.parse(event);
      // Fase 16: no imprimir datos financieros reales en un log de
      // release (ver mismo razonamiento en background_dispatcher.dart).
      if (kDebugMode) {
        debugPrint(
          '[NotificationEvent] packageName=${event.packageName} '
          'appName=${event.appName} title=${event.title} text=${event.text} '
          'timestamp=${event.timestamp}',
        );
        debugPrint(
          '[ParsedTransaction] amount=${parsed?.amount} type=${parsed?.type} '
          'note=${parsed?.note}',
        );
      }

      // Fase 6: si logramos extraer un monto, revisar que no sea un
      // duplicado (p. ej. Android/Samsung disparando onNotificationPosted
      // dos veces para la misma notificacion) antes de mostrarlo. Usa su
      // propio "scope" para no competir por el mismo fingerprint que usa
      // el motor headless de la Fase 7 (ver notification_deduplicator.dart).
      if (parsed != null && parsed.isParsed) {
        final isDuplicate = await _deduplicator.isDuplicate(
          parsed,
          scope: 'debug_list',
        );
        if (isDuplicate) {
          if (kDebugMode) {
            debugPrint('[Deduplicator] duplicado ignorado: ${parsed.note}');
          }
          return;
        }
      }

      if (!mounted) return;
      setState(() => _events.insert(0, (event, parsed)));
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _refreshAccessStatus();
    }
  }

  Future<void> _refreshAccessStatus() async {
    final granted = await _bridge.isNotificationAccessGranted();
    if (mounted) setState(() => _accessGranted = granted);
  }

  String _typeLabel(TransactionType type) {
    switch (type) {
      case TransactionType.expense:
        return 'Gasto';
      case TransactionType.income:
        return 'Ingreso';
      case TransactionType.unknown:
        return 'Desconocido (no se registraría automáticamente)';
    }
  }

  Color _typeColor(TransactionType type) {
    switch (type) {
      case TransactionType.expense:
        return Colors.red;
      case TransactionType.income:
        return Colors.blue;
      case TransactionType.unknown:
        return Colors.orange;
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notificaciones (debug)'),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings),
            tooltip: 'Apps monitoreadas',
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const MonitoredAppsPage()),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Cerrar sesión',
            onPressed: () => FirebaseAuth.instance.signOut(),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        icon: const Icon(Icons.add),
        label: const Text('Registrar movimiento'),
        onPressed: () {
          Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => ConfirmMovementPage.manual()),
          );
        },
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                Text(
                  'Sesión: ${FirebaseAuth.instance.currentUser?.email ?? '—'} '
                  '(uid: ${FirebaseAuth.instance.currentUser?.uid ?? '—'})',
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 12, color: Colors.grey),
                ),
                const SizedBox(height: 8),
                Text(
                  _accessGranted
                      ? 'Acceso a notificaciones: concedido'
                      : 'Acceso a notificaciones: NO concedido',
                  style: TextStyle(
                    color: _accessGranted ? Colors.green : Colors.red,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 8),
                ElevatedButton(
                  onPressed: _bridge.openNotificationListenerSettings,
                  child: const Text('Abrir ajustes de notificaciones'),
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          Expanded(
            child: _events.isEmpty
                ? const Center(child: Text('Sin notificaciones capturadas todavía'))
                : ListView.builder(
                    itemCount: _events.length,
                    itemBuilder: (context, index) {
                      final (event, parsed) = _events[index];
                      final isParsed = parsed?.isParsed ?? false;
                      return ListTile(
                        title: Text('${event.appName} (${event.packageName})'),
                        subtitle: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('${event.title}\n${event.text}'),
                            Text(
                              isParsed
                                  ? 'Monto detectado: \$${parsed!.amount!.toStringAsFixed(2)}'
                                  : 'No se pudo extraer un monto',
                              style: TextStyle(
                                color: isParsed ? Colors.green : Colors.grey,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            if (isParsed)
                              Text(
                                'Tipo: ${_typeLabel(parsed!.type)}',
                                style: TextStyle(
                                  color: _typeColor(parsed.type),
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                          ],
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
