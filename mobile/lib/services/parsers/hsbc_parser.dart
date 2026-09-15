import '../../models/notification_event.dart';
import '../../models/parsed_transaction.dart';
import 'generic_parser.dart';
import 'notification_parser.dart';

/// TODO: calibrar con el formato real de las notificaciones de HSBC México
/// (mx.hsbc.hsbcmexico) en cuanto se capture una en el log de la pantalla
/// de debug. Por ahora delega al parser genérico.
class HsbcParser implements NotificationParser {
  final GenericParser _fallback = GenericParser();

  @override
  ParsedTransaction? parse(NotificationEvent event) => _fallback.parse(event);
}
