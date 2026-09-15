import 'transaction_type.dart';

class ParsedTransaction {
  final double? amount;
  final String? note;
  final TransactionType type;
  // null por ahora: se llenan en la Fase 9 con la cuenta/categoría real
  // que el usuario elija en la pantalla de confirmación.
  final String? accountId;
  final String? categoryId;
  final String sourcePackageName;
  final int timestamp;

  const ParsedTransaction({
    required this.amount,
    required this.note,
    required this.type,
    required this.sourcePackageName,
    required this.timestamp,
    this.accountId,
    this.categoryId,
  });

  bool get isParsed => amount != null;

  /// Fase 5: un movimiento `unknown` nunca debe registrarse
  /// automáticamente (Apéndice A del plan). Las fases posteriores que
  /// escriban a Firebase deben respetar este flag.
  bool get isRegistrable => isParsed && type != TransactionType.unknown;
}
