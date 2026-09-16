import '../../models/parsed_transaction.dart';
import '../../models/transaction_type.dart';
import '../input_sources/input_source.dart';

/// Fase 15.2: convierte la frase reconocida por voz en el reloj —
/// "&lt;monto&gt; &lt;categoría&gt;" (ej. "326 comida", o dicho en
/// palabras: "trescientos veintiséis comida") — en un
/// [ParsedTransaction]. Reutiliza el mismo modelo que ya usan las
/// notificaciones (Fase 4/5) para poder pasar por
/// `NotificationDeduplicator.isDuplicate()` tal cual — ver
/// `background_dispatcher.dart`.
///
/// Sin palabra delimitadora entre monto y categoría (a propósito, es más
/// natural de decir): se consumen tokens numéricos desde el inicio de la
/// frase hasta encontrar la primera palabra que ya no es parte del
/// número — ahí empieza la categoría, sea cual sea el resto del texto.
///
/// El texto de categoría dicho por voz viaja temporalmente en `note`
/// (campo libre de `ParsedTransaction`) solo como transporte hacia el
/// paso de matching contra las categorías reales del hogar — nunca se
/// guarda tal cual en Firebase como nota del movimiento (Fase 16: nunca
/// texto crudo sin revisar).
class VoiceParser implements InputSource<String> {
  static final RegExp _digitsRegex = RegExp(r'^\d+([.,]\d+)?$');

  @override
  ParsedTransaction? parse(String raw) {
    final tokens = raw.trim().split(RegExp(r'\s+'));
    if (tokens.isEmpty || tokens.first.isEmpty) return null;

    double? amount;
    int categoryStart;

    if (_digitsRegex.hasMatch(tokens.first)) {
      amount = double.tryParse(tokens.first.replaceAll(',', '.'));
      categoryStart = 1;
    } else {
      final consumed = _consumeNumberWords(tokens);
      amount = consumed?.$1;
      categoryStart = consumed?.$2 ?? 0;
    }

    if (amount == null || amount <= 0) return null;

    final category = tokens.sublist(categoryStart).join(' ').trim();
    if (category.isEmpty) return null;

    return ParsedTransaction(
      amount: amount,
      note: category,
      type: TransactionType.expense,
      sourcePackageName: 'voice',
      timestamp: DateTime.now().millisecondsSinceEpoch,
    );
  }

  static const _units = {
    'cero': 0, 'un': 1, 'uno': 1, 'una': 1, 'dos': 2, 'tres': 3, 'cuatro': 4,
    'cinco': 5, 'seis': 6, 'siete': 7, 'ocho': 8, 'nueve': 9,
    'diez': 10, 'once': 11, 'doce': 12, 'trece': 13, 'catorce': 14,
    'quince': 15, 'dieciseis': 16, 'diecisiete': 17, 'dieciocho': 18,
    'diecinueve': 19, 'veinte': 20, 'veintiun': 21, 'veintiuno': 21,
    'veintidos': 22, 'veintitres': 23, 'veinticuatro': 24, 'veinticinco': 25,
    'veintiseis': 26, 'veintisiete': 27, 'veintiocho': 28, 'veintinueve': 29,
  };

  static const _tens = {
    'treinta': 30, 'cuarenta': 40, 'cincuenta': 50, 'sesenta': 60,
    'setenta': 70, 'ochenta': 80, 'noventa': 90,
  };

  static const _hundreds = {
    'cien': 100, 'ciento': 100, 'doscientos': 200, 'doscientas': 200,
    'trescientos': 300, 'trescientas': 300, 'cuatrocientos': 400,
    'cuatrocientas': 400, 'quinientos': 500, 'quinientas': 500,
    'seiscientos': 600, 'seiscientas': 600, 'setecientos': 700,
    'setecientas': 700, 'ochocientos': 800, 'ochocientas': 800,
    'novecientos': 900, 'novecientas': 900,
  };

  /// Consume tokens numéricos en palabras desde el inicio de [tokens]
  /// (p. ej. "trescientos veintiséis") y devuelve `(monto, índice donde
  /// sigue el resto de la frase)`, o `null` si no arranca con ninguno.
  (double, int)? _consumeNumberWords(List<String> tokens) {
    var total = 0;
    var current = 0;
    var matchedAny = false;
    var i = 0;

    for (; i < tokens.length; i++) {
      final token = _stripAccents(tokens[i].toLowerCase());
      if (token == 'y' && matchedAny) {
        continue;
      } else if (token == 'mil') {
        total += (current == 0 ? 1 : current) * 1000;
        current = 0;
        matchedAny = true;
      } else if (_hundreds.containsKey(token)) {
        current += _hundreds[token]!;
        matchedAny = true;
      } else if (_tens.containsKey(token)) {
        current += _tens[token]!;
        matchedAny = true;
      } else if (_units.containsKey(token)) {
        current += _units[token]!;
        matchedAny = true;
      } else {
        break;
      }
    }

    if (!matchedAny) return null;
    return ((total + current).toDouble(), i);
  }

  String _stripAccents(String input) {
    const from = 'áéíóúñ';
    const to = 'aeioun';
    var result = input;
    for (var i = 0; i < from.length; i++) {
      result = result.replaceAll(from[i], to[i]);
    }
    return result;
  }
}
