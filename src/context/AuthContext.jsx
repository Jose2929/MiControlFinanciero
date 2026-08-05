import { createContext, useContext, useEffect, useState } from 'react'
import { USER } from '../data/mockData'

const AuthContext = createContext(null)
const STORAGE_KEY = 'mcf-session'
const SIGN_IN_DELAY = 900

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('checking') // checking | signed-out | signed-in
  const [pendingProvider, setPendingProvider] = useState(null) // 'email' | 'google' | null

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === '1') {
      setUser(USER)
      setStatus('signed-in')
    } else {
      setStatus('signed-out')
    }
  }, [])

  async function signIn() {
    setPendingProvider('email')
    await wait(SIGN_IN_DELAY)
    window.localStorage.setItem(STORAGE_KEY, '1')
    setUser(USER)
    setStatus('signed-in')
    setPendingProvider(null)
  }

  async function signInWithGoogle() {
    setPendingProvider('google')
    await wait(SIGN_IN_DELAY)
    window.localStorage.setItem(STORAGE_KEY, '1')
    setUser(USER)
    setStatus('signed-in')
    setPendingProvider(null)
  }

  async function register() {
    return signIn()
  }

  function signOut() {
    window.localStorage.removeItem(STORAGE_KEY)
    setUser(null)
    setStatus('signed-out')
  }

  const value = {
    user,
    status,
    pendingProvider,
    isAuthenticated: status === 'signed-in',
    signIn,
    signInWithGoogle,
    register,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
