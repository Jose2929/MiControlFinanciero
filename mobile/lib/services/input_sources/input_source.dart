import '../../models/parsed_transaction.dart';

/// Fase 14/15.2: interfaz mínima para cualquier fuente de entrada que
/// pueda producir un movimiento parseado — hoy solo la implementa
/// `VoiceParser`. `NotificationParser`/`ParserRegistry` (Fase 4, ya
/// probado en producción) no se retro-adapta a esta interfaz: no hay
/// otro consumidor real todavía que lo justifique.
abstract class InputSource<TRaw> {
  ParsedTransaction? parse(TRaw raw);
}
