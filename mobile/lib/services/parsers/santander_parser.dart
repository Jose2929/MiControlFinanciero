import '../../models/notification_event.dart';
import '../../models/parsed_transaction.dart';
import 'generic_parser.dart';
import 'notification_parser.dart';
import 'transaction_type_detector.dart';

/// Calibrado 2026-09-14 con una notificación real capturada de Santander
/// (Súper Móvil, mx.bancosantander.supermovil):
///
///   título: "Compra con tarjeta"
///   texto:  "En MERCADO PAGO por $3,769.80 MXN con tarjeta de credito
///            **3939, el 14/09/2026 a las 12:59:40."
///
/// Si el texto no calza con ese formato (p. ej. otro tipo de notificación
/// de Santander que aún no hemos visto, como una transferencia recibida),
/// cae al parser genérico en vez de fallar.
class SantanderParser implements NotificationParser {
  static final RegExp _compraConTarjetaRegex = RegExp(
    r'^En (.+?) por \$([0-9,.]+) MXN con tarjeta de credito',
    caseSensitive: false,
  );

  final GenericParser _fallback = GenericParser();
  final TransactionTypeDetector _typeDetector = TransactionTypeDetector();

  @override
  ParsedTransaction? parse(NotificationEvent event) {
    final match = _compraConTarjetaRegex.firstMatch(event.text.trim());
    if (match == null) return _fallback.parse(event);

    final merchant = match.group(1)!.trim();
    final amount = double.tryParse(match.group(2)!.replaceAll(',', ''));
    if (amount == null) return _fallback.parse(event);

    return ParsedTransaction(
      amount: amount,
      note: merchant,
      type: _typeDetector.detect(event),
      sourcePackageName: event.packageName,
      timestamp: event.timestamp,
    );
  }
}
