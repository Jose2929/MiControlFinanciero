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
    // La sesión de Firebase Auth del WebView persiste sola entre aperturas
    // (igual que en cualquier navegador) — si ya hay sesión, no hace falta
    // (ni conviene) pedir un idToken nativo: en teléfonos con varias
    // cuentas de Google guardadas eso puede mostrar un selector
    // interactivo en vez de resolverse en silencio.
    if (await _alreadySignedInOnWeb()) return;

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

  // `window.__mcfAuthUid` (ver src/lib/firebase.js) empieza en 'pending'
  // hasta que Firebase resuelve el estado real de sesión — se espera a que
  // deje de ser 'pending' (con un límite corto) antes de decidir.
  Future<bool> _alreadySignedInOnWeb() async {
    for (var attempt = 0; attempt < 10; attempt++) {
      final value = await _readJsString('window.__mcfAuthUid');
      if (value != 'pending') return value != null;
      await Future.delayed(const Duration(milliseconds: 300));
    }
    return false;
  }

  Future<String?> _readJsString(String expression) async {
    final result = await _controller.runJavaScriptReturningResult(expression);
    var text = result.toString();
    if (text.startsWith('"') && text.endsWith('"')) {
      text = jsonDecode(text) as String;
    }
    return text == 'null' ? null : text;
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
