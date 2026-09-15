import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../models/notification_event.dart';
import '../models/transaction_type.dart';
import '../services/notification_deduplicator.dart';
import '../services/parsers/parser_registry.dart';

const String backgroundProcessorChannelName = 'mcf/background_processor';

/// Fase 7: entrypoint que Android ejecuta en un `FlutterEngine` headless
/// (sin Activity/UI), disparado desde `NotificationListener.kt` cada vez
/// que llega una notificación de una app monitoreada — funcione o no la
/// UI de Flutter en ese momento. Corre la misma lógica ya usada en la
/// pantalla de debug (`ParserRegistry`, `NotificationDeduplicator`) para
/// que haya una sola fuente de verdad del "cómo interpretamos esto".
///
/// `vm:entry-point` es obligatorio: sin esto, el compilador Dart en
/// builds release/profile elimina esta función por tree-shaking al no
/// verla llamada desde `main()`.
@pragma('vm:entry-point')
void backgroundNotificationDispatcher() {
  WidgetsFlutterBinding.ensureInitialized();

  const channel = MethodChannel(backgroundProcessorChannelName);
  final parserRegistry = ParserRegistry();
  final deduplicator = NotificationDeduplicator();

  channel.setMethodCallHandler((call) async {
    if (call.method != 'processNotification') return null;

    try {
      final event = NotificationEvent.fromMap(call.arguments as Map);
      debugPrint(
        '[Background] packageName=${event.packageName} title=${event.title} '
        'text=${event.text}',
      );

      final parsed = parserRegistry.parse(event);
      debugPrint(
        '[Background] parsed amount=${parsed?.amount} type=${parsed?.type} '
        'isRegistrable=${parsed?.isRegistrable}',
      );

      if (parsed == null || !parsed.isRegistrable) {
        debugPrint('[Background] no es un movimiento valido, se ignora');
        return null;
      }

      final isDuplicate = await deduplicator.isDuplicate(
        parsed,
        scope: 'own_notification',
      );
      if (isDuplicate) {
        debugPrint('[Background] duplicado, se ignora');
        return null;
      }

      final title = parsed.type == TransactionType.expense
          ? 'Gasto detectado'
          : 'Ingreso detectado';
      final amountText = '\$${parsed.amount!.toStringAsFixed(2)}';
      final text = parsed.note != null && parsed.note!.isNotEmpty
          ? '$amountText — ${parsed.note}'
          : amountText;

      debugPrint('[Background] publicando notificacion propia: $title / $text');
      await channel.invokeMethod('postOwnNotification', {
        'title': title,
        'text': text,
        'packageName': parsed.sourcePackageName,
        'amount': parsed.amount,
        'note': parsed.note,
        'timestamp': parsed.timestamp,
        'type': parsed.type.name,
      });
    } finally {
      // Le avisa a nativo que ya puede destruir este engine headless.
      await channel.invokeMethod('done');
    }
    return null;
  });

  channel.invokeMethod('backgroundEngineReady');
}
