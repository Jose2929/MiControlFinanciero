import '../../models/notification_event.dart';
import '../../models/parsed_transaction.dart';
import 'notification_parser.dart';
import 'transaction_type_detector.dart';

/// Extrae un monto en formato moneda genérico (p. ej. "$250.00",
/// "$1,234.56") del título/texto de la notificación. No asume idioma ni
/// formato específico de ningún banco — es el fallback cuando no hay (o
/// aún no se ha calibrado) un parser dedicado para la app de origen.
///
/// Fase 16: `note` se deja en `null` a propósito, nunca el texto crudo de
/// la notificación — a diferencia de un parser calibrado (que solo
/// extrae el comercio), este fallback no sabe distinguir el comercio del
/// resto del texto (referencias, dígitos de tarjeta enmascarados, etc.),
/// y ese texto se precargaría en la pantalla de confirmación pudiendo
/// terminar tal cual en Firebase (Apéndice A: nunca notificaciones
/// completas). El usuario puede escribir su propia nota si quiere.
class GenericParser implements NotificationParser {
  // El primer grupo de dígitos usa `+` (no `{1,3}`) para no asumir que un
  // monto de 4+ cifras siempre trae comas de separador de miles — un
  // "$1000.00" sin comas solo capturaba "100" con esa restricción,
  // perdiendo el resto del monto silenciosamente.
  static final RegExp _amountRegex = RegExp(
    r'\$\s?([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)',
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
      note: null,
      type: _typeDetector.detect(event),
      sourcePackageName: event.packageName,
      timestamp: event.timestamp,
    );
  }
}
