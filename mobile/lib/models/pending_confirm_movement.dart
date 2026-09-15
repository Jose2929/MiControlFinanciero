import 'transaction_type.dart';

TransactionType _typeFromString(String? value) {
  return TransactionType.values.firstWhere(
    (t) => t.name == value,
    orElse: () => TransactionType.unknown,
  );
}

/// Datos que llegan desde `MainActivity.kt` (extras del Intent de la
/// notificación "Gasto/Ingreso detectado", Fase 7) vía el canal
/// `mcf/confirm_movement`.
class PendingConfirmMovement {
  final String? sourcePackageName;
  final double amount;
  final String? note;
  final int timestamp;
  final TransactionType type;

  const PendingConfirmMovement({
    required this.sourcePackageName,
    required this.amount,
    required this.note,
    required this.timestamp,
    required this.type,
  });

  factory PendingConfirmMovement.fromMap(Map<dynamic, dynamic> map) {
    return PendingConfirmMovement(
      sourcePackageName: map['packageName'] as String?,
      amount: (map['amount'] as num?)?.toDouble() ?? 0.0,
      note: map['note'] as String?,
      timestamp: (map['timestamp'] as num?)?.toInt() ?? 0,
      type: _typeFromString(map['type'] as String?),
    );
  }
}
