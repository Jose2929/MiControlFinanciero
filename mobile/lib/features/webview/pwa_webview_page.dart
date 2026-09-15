import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:webview_flutter/webview_flutter.dart';

const _pwaUrl = 'https://jose2929.github.io/MiControlFinanciero/';

/// Fase 8.5: "wrapper" nativo de la PWA completa. Comparte sesión con el
/// login nativo (Fase 8) reproduciendo el mismo idToken de Google contra
/// `window.__mcfNativeSignIn` (ver `src/lib/firebase.js` en el repo web) —
/// evita que el usuario tenga que iniciar sesión otra vez dentro del
/// WebView, algo que además no funcionaría con Google (bloquea su propio
/// `signInWithPopup` dentro de WebViews embebidos).
class PwaWebViewPage extends StatefulWidget {
  const PwaWebViewPage({super.key});

  @override
  State<PwaWebViewPage> createState() => _PwaWebViewPageState();
}

class _PwaWebViewPageState extends State<PwaWebViewPage> {
  late final WebViewController _controller;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(onPageFinished: (_) => _injectNativeSignIn()),
      )
      ..loadRequest(Uri.parse(_pwaUrl));
  }

  Future<void> _injectNativeSignIn() async {
    final idToken = await _freshGoogleIdToken();
    // Sin Google Sign-In nativo (p. ej. cuenta email/password) la PWA
    // simplemente muestra su propio login dentro del WebView — funciona
    // normal, ese flujo no tiene el bloqueo de Google en WebViews.
    if (idToken == null) return;

    final encodedToken = jsonEncode(idToken);
    await _controller.runJavaScript('''
      (function retry(attemptsLeft) {
        if (window.__mcfNativeSignIn) {
          window.__mcfNativeSignIn($encodedToken);
        } else if (attemptsLeft > 0) {
          setTimeout(function () { retry(attemptsLeft - 1); }, 300);
        }
      })(15);
    ''');
  }

  // Silencioso, sin UI — el usuario ya dio consentimiento nativamente
  // (Fase 8), así que no hace falta pedirlo de nuevo cada vez que se abre
  // esta pestaña.
  Future<String?> _freshGoogleIdToken() async {
    try {
      final future = GoogleSignIn.instance.attemptLightweightAuthentication();
      final account = future == null ? null : await future;
      return account?.authentication.idToken;
    } catch (_) {
      return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('MiControlFinanciero')),
      body: WebViewWidget(controller: _controller),
    );
  }
}
