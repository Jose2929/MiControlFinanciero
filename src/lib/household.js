// ---------------------------------------------------------------------------
// Lógica de alta y gestión de "hogares" (households) — el nodo compartido de
// Realtime Database bajo el que vive la información financiera de 1+ personas.
// Sin UI aquí; ver HouseholdContext.jsx para el estado reactivo y Profile.jsx
// para la pantalla de invitación.
// ---------------------------------------------------------------------------

import { ref, get, set, update, push } from 'firebase/database'
import { db } from './firebase'

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sin 0/O/1/I para evitar confusión

function randomCode(length = 8) {
  const bytes = new Uint32Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
}

// Si el usuario ya tiene un hogar, devuelve su id. Si no, crea uno nuevo y lo
// vuelve 'owner'.
//
// Las escrituras van SECUENCIALES a propósito (no en un solo update() en
// bloque): las reglas de seguridad de cada ruta solo pueden validar contra
// estado YA CONFIRMADO en la base — no existe forma en el lenguaje de reglas
// de RTDB de contar hijos (no hay `numChildren()`) ni de asumir con certeza
// qué ven las reglas de rutas hermanas dentro del mismo update() múltiple.
// Por eso primero se crea `meta` (permitido porque aún no existe), y solo
// entonces se puede escribir `members/{uid}` (la regla valida contra
// `meta/createdBy`, que para ese punto ya es un valor real y confirmado).
export async function ensureHousehold(uid, userProfile) {
  const pointerSnap = await get(ref(db, `users/${uid}/householdId`))
  const existingId = pointerSnap.val()
  if (existingId) return existingId

  const hid = push(ref(db, 'households')).key
  const now = new Date().toISOString()

  await set(ref(db, `households/${hid}/meta`), {
    name: userProfile?.name ? `Hogar de ${userProfile.name}` : 'Mi hogar',
    createdAt: now,
    createdBy: uid,
  })
  await set(ref(db, `households/${hid}/members/${uid}`), {
    role: 'owner',
    name: userProfile?.name || null,
    email: userProfile?.email || null,
    joinedAt: now,
  })
  await update(ref(db), {
    [`users/${uid}/householdId`]: hid,
    [`users/${uid}/profile`]: {
      name: userProfile?.name || null,
      email: userProfile?.email || null,
      photoURL: userProfile?.photoURL || null,
    },
  })

  return hid
}

// Genera (o regenera) el código de invitación activo de un hogar. Solo el
// owner tiene permiso de escritura sobre `inviteCode` (ver database.rules.json).
export async function regenerateInviteCode(householdId, uid) {
  const code = randomCode()
  const now = new Date().toISOString()
  await update(ref(db), {
    [`households/${householdId}/inviteCode`]: code,
    [`inviteCodes/${code}`]: { householdId, createdAt: now, createdBy: uid },
  })
  return code
}

// Resuelve un código de invitación a su hogar y te suma como miembro.
//
// Igual que en ensureHousehold, las escrituras van secuenciales: primero se
// registra el código reclamado en `joinCodeUsed/{uid}` (permitido porque cada
// quien siempre puede escribir su propio nodo ahí), y solo entonces se puede
// escribir `members/{uid}` — su regla compara `joinCodeUsed/{uid}` contra el
// `inviteCode` vigente del hogar, y para ese punto el primero ya es un valor
// real y confirmado, no una escritura simultánea especulativa.
export async function joinHouseholdByCode(uid, userProfile, code) {
  const normalizedCode = code.trim().toUpperCase()
  if (!normalizedCode) throw new Error('Ingresa un código de invitación.')

  const indexSnap = await get(ref(db, `inviteCodes/${normalizedCode}`))
  const entry = indexSnap.val()
  if (!entry?.householdId) throw new Error('Ese código no es válido o ya expiró.')

  const { householdId } = entry
  const now = new Date().toISOString()

  await set(ref(db, `households/${householdId}/joinCodeUsed/${uid}`), normalizedCode)
  await set(ref(db, `households/${householdId}/members/${uid}`), {
    role: 'member',
    name: userProfile?.name || null,
    email: userProfile?.email || null,
    joinedAt: now,
  })
  await update(ref(db), {
    [`users/${uid}/householdId`]: householdId,
    [`users/${uid}/profile`]: {
      name: userProfile?.name || null,
      email: userProfile?.email || null,
      photoURL: userProfile?.photoURL || null,
    },
  })

  return householdId
}
