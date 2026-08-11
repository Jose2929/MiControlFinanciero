import { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  updateProfile,
  signOut as firebaseSignOut,
} from 'firebase/auth'
import { auth } from '../lib/firebase'

const AuthContext = createContext(null)

const ERROR_MESSAGES = {
  'auth/invalid-email': 'El correo no es válido.',
  'auth/user-disabled': 'Esta cuenta fue deshabilitada.',
  'auth/user-not-found': 'No existe una cuenta con ese correo.',
  'auth/wrong-password': 'Contraseña incorrecta.',
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/email-already-in-use': 'Ya existe una cuenta con ese correo.',
  'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
  'auth/popup-closed-by-user': 'Se cerró la ventana de Google antes de terminar.',
  'auth/network-request-failed': 'Sin conexión. Revisa tu internet e intenta de nuevo.',
  'auth/too-many-requests': 'Demasiados intentos. Espera un momento e intenta de nuevo.',
}

function friendlyError(err) {
  return ERROR_MESSAGES[err?.code] || 'Ocurrió un error inesperado. Intenta de nuevo.'
}

// Normaliza el usuario de Firebase Auth a la forma que usa el resto de la app
// (Avatar, TopBar, Profile ya leen `user.name`).
function normalizeUser(firebaseUser) {
  if (!firebaseUser) return null
  return {
    uid: firebaseUser.uid,
    name: firebaseUser.displayName || firebaseUser.email,
    email: firebaseUser.email,
    photoURL: firebaseUser.photoURL,
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('checking') // checking | signed-out | signed-in
  const [pendingProvider, setPendingProvider] = useState(null) // 'email' | 'google' | null
  const [error, setError] = useState(null)
  // Aviso persistente que sobrevive al cierre de sesión forzado (p.ej. sesión
  // expirada) para mostrarse en Login después del redirect automático.
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(normalizeUser(firebaseUser))
      setStatus(firebaseUser ? 'signed-in' : 'signed-out')
    })
    return unsubscribe
  }, [])

  async function signIn(email, password) {
    setError(null)
    setPendingProvider('email')
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (err) {
      setError(friendlyError(err))
      throw err
    } finally {
      setPendingProvider(null)
    }
  }

  async function signInWithGoogle() {
    setError(null)
    setPendingProvider('google')
    try {
      await signInWithPopup(auth, new GoogleAuthProvider())
    } catch (err) {
      setError(friendlyError(err))
      throw err
    } finally {
      setPendingProvider(null)
    }
  }

  async function register(email, password, name) {
    setError(null)
    setPendingProvider('email')
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password)
      if (name?.trim()) {
        await updateProfile(credential.user, { displayName: name.trim() })
        setUser(normalizeUser(credential.user))
      }
    } catch (err) {
      setError(friendlyError(err))
      throw err
    } finally {
      setPendingProvider(null)
    }
  }

  function signOut(reason) {
    if (reason) setNotice(reason)
    return firebaseSignOut(auth)
  }

  function clearNotice() {
    setNotice(null)
  }

  const value = {
    user,
    status,
    pendingProvider,
    error,
    notice,
    isAuthenticated: status === 'signed-in',
    signIn,
    signInWithGoogle,
    register,
    signOut,
    clearNotice,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
