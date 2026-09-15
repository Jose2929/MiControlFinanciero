import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../../models/pending_confirm_movement.dart';
import '../../services/confirm_movement_channel.dart';
import '../confirm/confirm_movement_page.dart';
import '../home/home_shell.dart';
import 'login_page.dart';

/// Fase 8: decide qué pantalla mostrar según el estado de sesión de
/// Firebase Auth. La persistencia de sesión ya la maneja el SDK, no hay
/// nada que guardar a mano aquí.
class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<User?>(
      stream: FirebaseAuth.instance.authStateChanges(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }
        if (snapshot.data == null) {
          return const LoginPage();
        }
        return const _SignedInGate();
      },
    );
  }
}

// Fase 9: cold start — si la app se abrió por la notificación de
// "movimiento detectado", entra directo a la pantalla de confirmación en
// vez de la lista de debug. Se pregunta una sola vez por sesión iniciada
// (ver `ConfirmMovementChannel.takePending`, consumo único del lado nativo).
class _SignedInGate extends StatefulWidget {
  const _SignedInGate();

  @override
  State<_SignedInGate> createState() => _SignedInGateState();
}

class _SignedInGateState extends State<_SignedInGate> {
  late final Future<PendingConfirmMovement?> _pendingFuture;

  @override
  void initState() {
    super.initState();
    _pendingFuture = ConfirmMovementChannel.takePending();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<PendingConfirmMovement?>(
      future: _pendingFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }
        final pending = snapshot.data;
        if (pending != null) {
          return ConfirmMovementPage(movement: pending);
        }
        return const HomeShell();
      },
    );
  }
}
