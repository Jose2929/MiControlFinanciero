import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { ref, onValue } from 'firebase/database'
import { db } from '../lib/firebase'
import { useAuth } from './AuthContext'
import { ensureHousehold, regenerateInviteCode, joinHouseholdByCode } from '../lib/household'

const HouseholdContext = createContext(null)

export function HouseholdProvider({ children }) {
  const { user } = useAuth()
  const [householdId, setHouseholdId] = useState(null)
  const [meta, setMeta] = useState(null)
  const [members, setMembers] = useState({})
  const [inviteCode, setInviteCode] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Al autenticarse, resuelve (o crea) el hogar del usuario.
  useEffect(() => {
    if (!user) {
      setHouseholdId(null)
      setMeta(null)
      setMembers({})
      setInviteCode(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    ensureHousehold(user.uid, user)
      .then((hid) => {
        if (!cancelled) setHouseholdId(hid)
      })
      .catch((err) => {
        console.error('No se pudo resolver el hogar del usuario:', err)
        if (!cancelled) setError('No se pudo preparar tu hogar. Intenta recargar la página.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  // Suscripción en vivo a metadatos, miembros y código de invitación del
  // hogar activo. El código vive en Firebase (regenerateInviteCode lo
  // escribe) — sin esta suscripción, la UI solo lo conocía en el instante en
  // que se generaba y lo perdía al recargar la página.
  useEffect(() => {
    if (!householdId) return
    const unsubMeta = onValue(ref(db, `households/${householdId}/meta`), (snap) => setMeta(snap.val()))
    const unsubMembers = onValue(ref(db, `households/${householdId}/members`), (snap) =>
      setMembers(snap.val() || {})
    )
    const unsubInviteCode = onValue(ref(db, `households/${householdId}/inviteCode`), (snap) =>
      setInviteCode(snap.val())
    )
    return () => {
      unsubMeta()
      unsubMembers()
      unsubInviteCode()
    }
  }, [householdId])

  const role = user && members[user.uid] ? members[user.uid].role : null

  const doRegenerateInviteCode = useCallback(() => {
    if (!householdId || !user) return Promise.reject(new Error('No hay hogar activo'))
    return regenerateInviteCode(householdId, user.uid)
  }, [householdId, user])

  const joinWithCode = useCallback(
    async (code) => {
      if (!user) throw new Error('Debes iniciar sesión primero')
      const newHouseholdId = await joinHouseholdByCode(user.uid, user, code)
      setHouseholdId(newHouseholdId)
      return newHouseholdId
    },
    [user]
  )

  const value = {
    householdId,
    householdName: meta?.name || null,
    members,
    memberList: Object.entries(members).map(([uid, m]) => ({ uid, ...m })),
    role,
    inviteCode,
    loading,
    error,
    regenerateInviteCode: doRegenerateInviteCode,
    joinWithCode,
  }

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>
}

export function useHousehold() {
  const ctx = useContext(HouseholdContext)
  if (!ctx) throw new Error('useHousehold debe usarse dentro de HouseholdProvider')
  return ctx
}
