import '../../models/notification_event.dart';
import '../../models/transaction_type.dart';

/// Clasifica una notificación como gasto, ingreso o desconocido, en base a
/// palabras clave comunes en notificaciones bancarias en español (México).
/// Genérico a propósito: no asume el formato exacto de ningún banco (ver
/// nota de la Fase 4 sobre parsers específicos aún no calibrados). Si el
/// texto no contiene ninguna palabra clave reconocible, o contiene
/// señales contradictorias, el resultado es `unknown` — nunca se debe
/// inferir un tipo "a la fuerza".
class TransactionTypeDetector {
  static const _expenseKeywords = [
    'cargo',
    'compra',
    'pago realizado',
    'pagaste',
    'retiro',
    'gastaste',
    'envío',
    'enviaste',
  ];

  static const _incomeKeywords = [
    'abono',
    'depósito',
    'deposito',
    'recibiste',
    'transferencia recibida',
    'ingreso',
    'te transfirieron',
    'te enviaron',
  ];

  TransactionType detect(NotificationEvent event) {
    final text = '${event.title} ${event.text}'.toLowerCase();

    final isExpense = _expenseKeywords.any(text.contains);
    final isIncome = _incomeKeywords.any(text.contains);

    if (isExpense && !isIncome) return TransactionType.expense;
    if (isIncome && !isExpense) return TransactionType.income;
    return TransactionType.unknown;
  }
}
