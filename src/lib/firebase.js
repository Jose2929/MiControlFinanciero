import { initializeApp } from 'firebase/app'
import { getAuth, onAuthStateChanged, signInWithCredential, GoogleAuthProvider } from 'firebase/auth'
import { getDatabase } from 'firebase/database'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getDatabase(app)

// Puente para el wrapper nativo (app Android/Flutter, ver
// mobile/lib/features/webview/pwa_webview_page.dart): permite repetir el
// mismo signInWithCredential que ya dispara el botón de Google de esta
// misma PWA (ver AuthContext.jsx), pero iniciado por JS inyectado desde el
// WebView nativo en vez de por el botón — necesario porque Google bloquea
// su propio signInWithPopup dentro de un WebView embebido. No es una vía
// de autenticación nueva ni menos segura: usa el idToken real de la
// sesión de Google ya autenticada nativamente en la app.
if (typeof window !== 'undefined') {
  window.__mcfNativeSignIn = (idToken) => {
    signInWithCredential(auth, GoogleAuthProvider.credential(idToken)).catch(() => {})
  }

  // Le permite al wrapper nativo saber si esta sesión del WebView ya está
  // autenticada (su propia sesión persiste sola entre aperturas) antes de
  // intentar __mcfNativeSignIn — evita pedir un idToken nativo (que en
  // dispositivos con varias cuentas de Google guardadas puede mostrar un
  // selector interactivo) cuando no hace falta. 'pending' hasta que
  // Firebase resuelve el estado inicial real; 'signed-out' (no `null`)
  // para que el lado nativo pueda distinguirlo sin ambigüedad de
  // "todavía no cargó este script" (ahí `window.__mcfAuthUid` sería
  // `undefined`, indistinguible de `null` una vez serializado).
  window.__mcfAuthUid = 'pending'
  onAuthStateChanged(auth, (user) => {
    window.__mcfAuthUid = user ? user.uid : 'signed-out'
  })
}
