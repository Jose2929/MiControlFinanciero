import '../../models/notification_event.dart';
import '../../models/parsed_transaction.dart';

abstract class NotificationParser {
  /// Devuelve `null` si no logra extraer nada útil de la notificación.
  ParsedTransaction? parse(NotificationEvent event);
}
