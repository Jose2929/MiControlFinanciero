import 'package:flutter/services.dart';

import '../models/parsed_transaction.dart';

/// Fase 6/7: evita procesar dos veces el mismo movimiento. Persistido
/// nativamente (SharedPreferences, ver `DedupPrefs.kt`) en vez de en
/// memoria, porque el motor headless de la Fase 7 crea un `FlutterEngine`
/// nuevo por cada notificación — sin esto, cada invocación empezaría con
/// el historial vacío. La pantalla de debug en foreground usa el mismo
/// canal, así que ambos caminos comparten una única fuente de verdad.
///
/// El fingerprint combina app de origen + monto + nota (comercio/
/// concepto) — deliberadamente sin el timestamp exacto, porque no se
/// puede asumir que un reintento del banco llegue con el mismo timestamp
/// o texto idéntico.
class NotificationDeduplicator {
  static const _channel = MethodChannel('mcf/dedup');

  /// `scope` separa el fingerprint por propósito (p. ej. "debug_list" vs
  /// "own_notification"), para que dos llamadores distintos verificando
  /// la misma notificación casi al mismo tiempo no se "roben" el
  /// fingerprint el uno al otro. `windowMs` (Fase 12) permite una ventana
  /// más larga que el default de 60s — por ejemplo para el chequeo justo
  /// antes de escribir a Firebase, donde una escritura pudo haber quedado
  /// encolada offline mucho más tiempo que eso.
  Future<bool> isDuplicate(
    ParsedTransaction transaction, {
    required String scope,
    int windowMs = 60000,
  }) async {
    final fingerprint = '$scope|${_fingerprint(transaction)}';
    final result = await _channel.invokeMethod<bool>('checkAndRecord', {
      'fingerprint': fingerprint,
      'windowMs': windowMs,
    });
    return result ?? false;
  }

  String _fingerprint(ParsedTransaction transaction) {
    return '${transaction.sourcePackageName}|${transaction.amount}|${transaction.note}';
  }
}
