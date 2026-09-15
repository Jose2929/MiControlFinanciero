import 'package:flutter/services.dart';

import '../models/pending_confirm_movement.dart';

/// Puente con `MainActivity.kt` para el flujo de confirmación (Fase 9):
/// cold start (app cerrada, se abre por la notificación) pide el pendiente
/// una vez con [takePending]; warm start (app ya corriendo) lo empuja solo
/// vía [listenForPushedMovements].
class ConfirmMovementChannel {
  static const _channel = MethodChannel('mcf/confirm_movement');

  static void listenForPushedMovements(
    void Function(PendingConfirmMovement movement) onMovement,
  ) {
    _channel.setMethodCallHandler((call) async {
      if (call.method == 'showConfirmMovement') {
        onMovement(
          PendingConfirmMovement.fromMap(call.arguments as Map<dynamic, dynamic>),
        );
      }
      return null;
    });
  }

  static Future<PendingConfirmMovement?> takePending() async {
    final result = await _channel.invokeMethod('takePendingConfirmMovement');
    if (result == null) return null;
    return PendingConfirmMovement.fromMap(result as Map<dynamic, dynamic>);
  }
}
