import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart' hide Category;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../firebase_options.dart';
import '../models/category.dart';
import '../models/notification_event.dart';
import '../models/parsed_transaction.dart';
import '../models/transaction_type.dart';
import '../models/account.dart';
import '../services/household_repository.dart';
import '../services/notification_deduplicator.dart';
import '../services/parsers/parser_registry.dart';
import '../services/parsers/voice_parser.dart';
import '../services/transaction_writer.dart';

const String backgroundProcessorChannelName = 'mcf/background_processor';

// Fase 12: misma ventana larga que ya usa ConfirmMovementPage antes de
// escribir a Firebase — una escritura pudo haber quedado encolada
// offline mucho mas tiempo que el default de deteccion (60s).
const _confirmedWriteDedupWindowMs = 24 * 60 * 60 * 1000;

/// Fase 7: entrypoint que Android ejecuta en un `FlutterEngine` headless
/// (sin Activity/UI), disparado desde `NotificationListener.kt` cada vez
/// que llega una notificación de una app monitoreada, desde
/// `QuickConfirmReceiver.kt` (Fase 15.1) al tocar "Aceptar" en la
/// notificación de movimiento detectado, o desde
/// `VoiceMessageListener.kt` (Fase 15.2) con una frase reconocida por voz
/// en el reloj — funcione o no la UI de Flutter en ese momento. El campo
/// `"kind"` del evento (`"notification"` | `"quick_confirm"` | `"voice"`)
/// decide cuál rama corre.
///
/// `vm:entry-point` es obligatorio: sin esto, el compilador Dart en
/// builds release/profile elimina esta función por tree-shaking al no
/// verla llamada desde `main()`.
@pragma('vm:entry-point')
void backgroundNotificationDispatcher() {
  WidgetsFlutterBinding.ensureInitialized();

  const channel = MethodChannel(backgroundProcessorChannelName);
  final parserRegistry = ParserRegistry();
  final deduplicator = NotificationDeduplicator();

  channel.setMethodCallHandler((call) async {
    if (call.method != 'processNotification') return null;

    try {
      final arguments = Map<String, dynamic>.from(call.arguments as Map);
      final kind = arguments['kind'] as String? ?? 'notification';
      if (kind == 'quick_confirm') {
        await _handleQuickConfirm(arguments, deduplicator);
      } else if (kind == 'voice') {
        final message = await _handleVoice(arguments, deduplicator);
        await channel.invokeMethod('reportResult', {'message': message});
      } else {
        await _handleNotification(arguments, channel, parserRegistry, deduplicator);
      }
    } finally {
      // Le avisa a nativo que ya puede destruir este engine headless.
      await channel.invokeMethod('done');
    }
    return null;
  });

  channel.invokeMethod('backgroundEngineReady');
}

Future<void> _handleNotification(
  Map<String, dynamic> arguments,
  MethodChannel channel,
  ParserRegistry parserRegistry,
  NotificationDeduplicator deduplicator,
) async {
  final event = NotificationEvent.fromMap(arguments);
  // Fase 16: título/texto crudo y monto/nota parseados son datos
  // financieros reales del usuario — no deben quedar en el log de un
  // build de release (adb logcat es legible con depuración USB). Al
  // ser `kDebugMode` una constante de compilación, este bloque entero
  // se elimina del build de release por tree-shaking.
  if (kDebugMode) {
    debugPrint(
      '[Background] packageName=${event.packageName} title=${event.title} '
      'text=${event.text}',
    );
  }

  final parsed = parserRegistry.parse(event);
  if (kDebugMode) {
    debugPrint(
      '[Background] parsed amount=${parsed?.amount} type=${parsed?.type} '
      'isRegistrable=${parsed?.isRegistrable}',
    );
  }

  if (parsed == null || !parsed.isRegistrable) {
    debugPrint('[Background] no es un movimiento valido, se ignora');
    return;
  }

  final isDuplicate = await deduplicator.isDuplicate(
    parsed,
    scope: 'own_notification',
  );
  if (isDuplicate) {
    debugPrint('[Background] duplicado, se ignora');
    return;
  }

  final title = parsed.type == TransactionType.expense
      ? 'Gasto detectado'
      : 'Ingreso detectado';
  final amountText = '\$${parsed.amount!.toStringAsFixed(2)}';
  final text = parsed.note != null && parsed.note!.isNotEmpty
      ? '$amountText — ${parsed.note}'
      : amountText;

  if (kDebugMode) {
    debugPrint('[Background] publicando notificacion propia: $title / $text');
  }
  await channel.invokeMethod('postOwnNotification', {
    'title': title,
    'text': text,
    'packageName': parsed.sourcePackageName,
    'amount': parsed.amount,
    'note': parsed.note,
    'timestamp': parsed.timestamp,
    'type': parsed.type.name,
  });
}

/// Fase 15.1: "Aceptar" desde la notificación (teléfono o la copia
/// reflejada en un reloj Wear OS emparejado) — registra el movimiento
/// con la primera cuenta/categoría del hogar, igual que hace
/// `ConfirmMovementPage` cuando el usuario no cambia el default
/// (`confirm_movement_page.dart:294`). Deliberadamente sin UI: es una
/// versión rápida del mismo flujo, no un reemplazo — "Revisar
/// movimiento" sigue abriendo la pantalla completa para elegir otra
/// cuenta/categoría.
Future<void> _handleQuickConfirm(
  Map<String, dynamic> arguments,
  NotificationDeduplicator deduplicator,
) async {
  final amount = (arguments['amount'] as num?)?.toDouble();
  if (amount == null || amount <= 0) {
    debugPrint('[Background] quick_confirm sin monto valido, se ignora');
    return;
  }
  final type = arguments['type'] == 'income'
      ? TransactionType.income
      : TransactionType.expense;
  final note = arguments['note'] as String?;
  final sourcePackageName = arguments['packageName'] as String? ?? '';
  final timestamp = (arguments['timestamp'] as num?)?.toInt() ?? 0;

  // Mismo chequeo (y misma ventana larga) que ConfirmMovementPage antes
  // de escribir — evita un segundo movimiento si el usuario también
  // confirma desde la pantalla completa del teléfono casi al mismo
  // tiempo que toca "Aceptar" en el reloj.
  final original = ParsedTransaction(
    amount: amount,
    note: note,
    type: type,
    sourcePackageName: sourcePackageName,
    timestamp: timestamp,
  );
  final isDuplicate = await deduplicator.isDuplicate(
    original,
    scope: 'confirmed_write',
    windowMs: _confirmedWriteDedupWindowMs,
  );
  if (isDuplicate) {
    debugPrint('[Background] quick_confirm: ya se habia guardado antes, se ignora');
    return;
  }

  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);

  final repository = HouseholdRepository();
  final householdId = await repository.getHouseholdId();
  if (householdId == null) {
    debugPrint('[Background] quick_confirm: no se encontro el hogar, se ignora');
    return;
  }

  final accounts = await repository.getAccounts(householdId);
  if (accounts.isEmpty) {
    debugPrint('[Background] quick_confirm: el hogar no tiene cuentas, se ignora');
    return;
  }
  final account = accounts.first;

  Category? category;
  if (type != TransactionType.income) {
    final categories = await repository.getCategories(householdId);
    if (categories.isNotEmpty) category = categories.first;
  }

  await TransactionWriter().confirmMovement(
    householdId: householdId,
    type: type,
    amount: amount,
    note: note ?? '',
    account: account,
    category: category,
    date: timestamp > 0 ? DateTime.fromMillisecondsSinceEpoch(timestamp) : DateTime.now(),
  );

  if (kDebugMode) {
    debugPrint('[Background] quick_confirm: movimiento guardado en $householdId');
  }
}

/// Fase 15.2: registra un gasto en efectivo dicho por voz desde la Tile
/// del reloj ("gasté 200 pesos en la categoría compras"). Devuelve un
/// mensaje corto para mostrar en el reloj (éxito o motivo del error) —
/// `VoiceMessageListener.kt` lo manda de vuelta por el mismo canal.
Future<String> _handleVoice(
  Map<String, dynamic> arguments,
  NotificationDeduplicator deduplicator,
) async {
  final phrase = arguments['phrase'] as String?;
  if (phrase == null || phrase.trim().isEmpty) {
    return 'No se reconoció ningún texto.';
  }

  final parsed = VoiceParser().parse(phrase);
  if (kDebugMode) {
    debugPrint('[Background] voice: phrase="$phrase" amount=${parsed?.amount}');
  }
  if (parsed == null || !parsed.isRegistrable) {
    return 'No entendí ese gasto. Intenta de nuevo.';
  }

  final isDuplicate = await deduplicator.isDuplicate(
    parsed,
    scope: 'confirmed_write',
    windowMs: _confirmedWriteDedupWindowMs,
  );
  if (isDuplicate) {
    return 'Ese gasto ya se había guardado.';
  }

  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);

  final repository = HouseholdRepository();
  final householdId = await repository.getHouseholdId();
  if (householdId == null) {
    return 'No se encontró tu hogar.';
  }

  final accounts = await repository.getAccounts(householdId);
  Account? cashAccount;
  for (final account in accounts) {
    if (account.type == AccountType.efectivo) {
      cashAccount = account;
      break;
    }
  }
  if (cashAccount == null) {
    return 'No tienes una cuenta de efectivo configurada.';
  }

  // El texto de categoría dicho por voz viaja en `parsed.note` (ver
  // VoiceParser) solo para este matching — nunca se guarda tal cual.
  final categories = await repository.getCategories(householdId);
  final spokenCategory = (parsed.note ?? '').toLowerCase();
  Category? matchedCategory;
  for (final category in categories) {
    final label = category.label.toLowerCase();
    if (spokenCategory.contains(label) || label.contains(spokenCategory)) {
      matchedCategory = category;
      break;
    }
  }
  if (matchedCategory == null) {
    for (final category in categories) {
      if (category.id == 'otros') {
        matchedCategory = category;
        break;
      }
    }
  }
  matchedCategory ??= categories.isNotEmpty ? categories.first : null;
  if (matchedCategory == null) {
    return 'Tu hogar no tiene categorías configuradas.';
  }

  await TransactionWriter().confirmMovement(
    householdId: householdId,
    type: TransactionType.expense,
    amount: parsed.amount!,
    note: '',
    account: cashAccount,
    category: matchedCategory,
    date: DateTime.now(),
  );

  if (kDebugMode) {
    debugPrint(
      '[Background] voice: guardado \$${parsed.amount} en ${matchedCategory.label}',
    );
  }
  return 'Guardado: \$${parsed.amount!.toStringAsFixed(0)} en ${matchedCategory.label}';
}
