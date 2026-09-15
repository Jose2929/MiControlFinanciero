import { initializeApp } from 'firebase/app'
import { getAuth, signInWithCredential, GoogleAuthProvider } from 'firebase/auth'
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
}
