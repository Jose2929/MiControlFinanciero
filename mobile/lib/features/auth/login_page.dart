import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:google_sign_in/google_sign_in.dart';

/// Fase 8: mismos métodos que ya usa la PWA (email/password y Google
/// Sign-In), mismo proyecto Firebase, mismo `uid`. Sin registro de cuenta
/// nueva aquí — se asume que la cuenta y el hogar ya existen (creados
/// desde la PWA).
class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _loading = false;
  bool _googleReady = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _initGoogleSignIn();
  }

  // Fase 8.5: la inicialización de GoogleSignIn.instance ya corrió en
  // main() (corre siempre, haya o no sesión guardada) — aquí solo hace
  // falta suscribirse a los eventos de autenticación. Se llama desde
  // initState, antes del primer build, así que basta con asignar el
  // campo directamente (sin setState: no hay nada que reconstruir todavía).
  void _initGoogleSignIn() {
    GoogleSignIn.instance.authenticationEvents.listen(_handleGoogleAuthEvent).onError(
      (Object error) {
        setState(() {
          _loading = false;
          _errorMessage = 'No se pudo iniciar sesión con Google.';
        });
      },
    );
    _googleReady = true;
  }

  Future<void> _handleGoogleAuthEvent(
    GoogleSignInAuthenticationEvent event,
  ) async {
    if (event is! GoogleSignInAuthenticationEventSignIn) return;

    final idToken = event.user.authentication.idToken;
    if (idToken == null) {
      setState(() {
        _loading = false;
        _errorMessage = 'Google no devolvió un token válido.';
      });
      return;
    }

    try {
      final credential = GoogleAuthProvider.credential(idToken: idToken);
      await FirebaseAuth.instance.signInWithCredential(credential);
    } on FirebaseAuthException catch (e) {
      setState(() => _errorMessage = _messageFor(e.code));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _signInWithGoogle() async {
    setState(() {
      _loading = true;
      _errorMessage = null;
    });
    try {
      await GoogleSignIn.instance.authenticate();
    } catch (e) {
      setState(() {
        _loading = false;
        _errorMessage = 'No se pudo iniciar sesión con Google.';
      });
    }
  }

  Future<void> _signInWithPassword() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _loading = true;
      _errorMessage = null;
    });

    try {
      await FirebaseAuth.instance.signInWithEmailAndPassword(
        email: _emailController.text.trim(),
        password: _passwordController.text,
      );
    } on FirebaseAuthException catch (e) {
      setState(() => _errorMessage = _messageFor(e.code));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _messageFor(String code) {
    switch (code) {
      case 'invalid-email':
        return 'Correo inválido.';
      case 'user-not-found':
      case 'invalid-credential':
        return 'No existe una cuenta con ese correo y contraseña.';
      case 'wrong-password':
        return 'Contraseña incorrecta.';
      case 'user-disabled':
        return 'Esta cuenta está deshabilitada.';
      default:
        return 'No se pudo iniciar sesión ($code).';
    }
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Iniciar sesión')),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'MiControlFinanciero',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 24),
                ElevatedButton.icon(
                  onPressed: (_loading || !_googleReady)
                      ? null
                      : _signInWithGoogle,
                  icon: const Icon(Icons.login),
                  label: const Text('Iniciar sesión con Google'),
                ),
                const SizedBox(height: 20),
                const Row(
                  children: [
                    Expanded(child: Divider()),
                    Padding(
                      padding: EdgeInsets.symmetric(horizontal: 8),
                      child: Text('o'),
                    ),
                    Expanded(child: Divider()),
                  ],
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(
                    labelText: 'Correo',
                    border: OutlineInputBorder(),
                  ),
                  validator: (value) =>
                      (value == null || value.trim().isEmpty)
                      ? 'Ingresa tu correo'
                      : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _passwordController,
                  obscureText: true,
                  decoration: const InputDecoration(
                    labelText: 'Contraseña',
                    border: OutlineInputBorder(),
                  ),
                  validator: (value) => (value == null || value.isEmpty)
                      ? 'Ingresa tu contraseña'
                      : null,
                  onFieldSubmitted: (_) => _signInWithPassword(),
                ),
                if (_errorMessage != null) ...[
                  const SizedBox(height: 12),
                  Text(
                    _errorMessage!,
                    style: const TextStyle(color: Colors.red),
                    textAlign: TextAlign.center,
                  ),
                ],
                const SizedBox(height: 20),
                OutlinedButton(
                  onPressed: _loading ? null : _signInWithPassword,
                  child: _loading
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Iniciar sesión con correo'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
