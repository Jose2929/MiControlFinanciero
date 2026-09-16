import '../../models/notification_event.dart';
import '../../models/parsed_transaction.dart';
import 'generic_parser.dart';
import 'google_wallet_parser.dart';
import 'hsbc_parser.dart';
import 'notification_parser.dart';
import 'paypal_parser.dart';
import 'santander_parser.dart';

class ParserRegistry {
  static final Map<String, NotificationParser> _parsers = {
    'mx.bancosantander.supermovil': SantanderParser(),
    'com.google.android.apps.walletnfcrel': GoogleWalletParser(),
    'com.paypal.android.p2pmobile': PayPalParser(),
    'mx.hsbc.hsbcmexico': HsbcParser(),
  };

  static final NotificationParser _fallback = GenericParser();

  ParsedTransaction? parse(NotificationEvent event) {
    // Fase 3 permite monitorear cualquier app instalada, no solo las 4
    // confirmadas en D6 — si no hay un parser dedicado para el paquete de
    // origen, se usa el generico en vez de ignorar el evento en silencio.
    final parser = _parsers[event.packageName] ?? _fallback;
    return parser.parse(event);
  }
}
