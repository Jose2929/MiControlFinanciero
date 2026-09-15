import '../../models/notification_event.dart';
import '../../models/parsed_transaction.dart';
import 'notification_parser.dart';
import 'transaction_type_detector.dart';

/// Extrae un monto en formato moneda genérico (p. ej. "$250.00",
/// "$1,234.56") del título/texto de la notificación. No asume idioma ni
/// formato específico de ningún banco — es el fallback cuando no hay (o
/// aún no se ha calibrado) un parser dedicado para la app de origen.
class GenericParser implements NotificationParser {
  static final RegExp _amountRegex = RegExp(
    r'\$\s?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)',
  );

  final TransactionTypeDetector _typeDetector = TransactionTypeDetector();

  @override
  ParsedTransaction? parse(NotificationEvent event) {
    final text = '${event.title} ${event.text}';
    final match = _amountRegex.firstMatch(text);
    if (match == null) return null;

    final amount = double.tryParse(match.group(1)!.replaceAll(',', ''));
    if (amount == null) return null;

    return ParsedTransaction(
      amount: amount,
      note: event.text.isNotEmpty ? event.text : event.title,
      type: _typeDetector.detect(event),
      sourcePackageName: event.packageName,
      timestamp: event.timestamp,
    );
  }
}
