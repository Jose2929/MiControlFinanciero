import 'dart:ui';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_database/firebase_database.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_sign_in/google_sign_in.dart';

import 'background/background_dispatcher.dart';
import 'features/auth/auth_gate.dart';
import 'features/confirm/confirm_movement_page.dart';
import 'firebase_options.dart';
import 'services/confirm_movement_channel.dart';
import 'services/google_sign_in_config.dart';

// Fase 9: permite empujar una ruta (pantalla de confirmación) desde fuera
// del árbol de widgets cuando `MainActivity.kt` avisa de un movimiento
// detectado con la app ya corriendo (warm start) — ver
// `ConfirmMovementChannel.listenForPushedMovements`.
final navigatorKey = GlobalKey<NavigatorState>();

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  // Fase 12: sin esto, una escritura hecha sin conexión solo se encola en
  // memoria — si la app se cierra antes de reconectar, se pierde. Con
  // persistencia en disco, el propio SDK la retoma sola al reconectar
  // aunque el proceso se haya matado por completo. Debe llamarse antes de
  // cualquier otro uso de FirebaseDatabase.instance en la app.
  FirebaseDatabase.instance.setPersistenceEnabled(true);
  // Fase 8.5: se hace aquí (no solo en LoginPage) porque si ya hay sesión
  // guardada, LoginPage nunca se construye — sin esto, GoogleSignIn
  // quedaría sin inicializar y PwaWebViewPage no podría pedir un idToken
  // fresco vía attemptLightweightAuthentication().
  await GoogleSignIn.instance.initialize(serverClientId: googleServerClientId);
  _registerBackgroundCallback();
  ConfirmMovementChannel.listenForPushedMovements((movement) {
    navigatorKey.currentState?.push(
      MaterialPageRoute(builder: (_) => ConfirmMovementPage(movement: movement)),
    );
  });
  runApp(const MyApp());
}

// Fase 7: le dice a Android qué función Dart ejecutar cuando arranque el
// engine headless (ver `background_dispatcher.dart`). Se registra en cada
// arranque de la app porque el handle puede cambiar entre builds; nativo
// lo persiste (`BackgroundCallbackPrefs.kt`) para poder usarlo después
// aunque la app ya esté cerrada.
void _registerBackgroundCallback() {
  final handle = PluginUtilities.getCallbackHandle(
    backgroundNotificationDispatcher,
  );
  if (handle == null) return;

  const MethodChannel(
    'mcf/background_setup',
  ).invokeMethod('registerCallbackHandle', {'handle': handle.toRawHandle()});
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      navigatorKey: navigatorKey,
      title: 'MiControlFinanciero',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple),
      ),
      home: const AuthGate(),
    );
  }
}
