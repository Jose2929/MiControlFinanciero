// ---------------------------------------------------------------------------
// Adaptadores de almacenamiento del perfil.
//
// Todos cumplen la misma interfaz mínima:
//   { load(): Promise<object|null>, save(profileObj): Promise<void> }
// El adaptador de Firebase además expone `subscribe(onChange)` para lectura
// en vivo (necesaria para que los cambios que guarda otro miembro del hogar
// aparezcan solos, sin recargar la página).
//
// Así FinanceContext no sabe (ni le importa) DÓNDE se guarda: el objeto que
// viaja siempre es el árbol nativo que produce serializeProfile().
// ---------------------------------------------------------------------------

/**
 * Adaptador de localStorage — funciona sin dependencias ni configuración.
 * Guarda el árbol como string JSON (localStorage solo almacena strings; eso es
 * solo el transporte: el objeto que viaja sigue siendo el árbol nativo).
 *
 * @param {string} key clave de localStorage.
 * @returns {{ load: () => Promise<object|null>, save: (obj: object) => Promise<void> }}
 */
export function createLocalStorageStore(key = 'mcf-profile') {
  return {
    async load() {
      if (typeof window === 'undefined') return null
      const raw = window.localStorage.getItem(key)
      if (!raw) return null
      try {
        return JSON.parse(raw)
      } catch {
        return null
      }
    },
    async save(obj) {
      if (typeof window === 'undefined') return
      window.localStorage.setItem(key, JSON.stringify(obj))
    },
  }
}

/**
 * Adaptador de Firebase Realtime Database.
 *
 * Guarda el OBJETO NATIVO (no un string) en `{basePath}/{id}/{leafPath}` —
 * por defecto `households/{householdId}/profile`, el nodo compartido del
 * hogar (ver src/lib/household.js y database.rules.json en la raíz del repo
 * para el modelo de datos y las reglas de seguridad completas).
 *
 * El SDK se inyecta por parámetro para mantener este archivo desacoplado de
 * la instancia concreta de Firebase — en la app se pasa desde
 * src/lib/firebase.js.
 *
 * @param {object}   deps
 * @param {object}   deps.db      instancia de Database (getDatabase(app)).
 * @param {Function} deps.ref     función `ref` de firebase/database.
 * @param {Function} deps.get     función `get` de firebase/database.
 * @param {Function} deps.set     función `set` de firebase/database.
 * @param {Function} deps.onValue función `onValue` de firebase/database.
 * @param {string}   deps.id      id del nodo (p. ej. el householdId).
 * @param {string}  [deps.basePath] ruta base (default `households`).
 * @param {string}  [deps.leafPath] sub-ruta bajo el id (default `profile`).
 * @returns {{
 *   load: () => Promise<object|null>,
 *   save: (obj: object) => Promise<void>,
 *   subscribe: (onChange: (obj: object|null) => void) => () => void,
 * }}
 */
export function createFirebaseRealtimeStore({
  db,
  ref,
  get,
  set,
  onValue,
  id,
  basePath = 'households',
  leafPath = 'profile',
}) {
  if (!db || !ref || !get || !set || !id) {
    throw new Error(
      'createFirebaseRealtimeStore requiere { db, ref, get, set, id }. ' +
        'Inyecta el SDK de firebase/database (ver src/lib/firebase.js).'
    )
  }
  const path = `${basePath}/${id}/${leafPath}`
  return {
    async load() {
      const snapshot = await get(ref(db, path))
      return snapshot.exists() ? snapshot.val() : null
    },
    async save(obj) {
      await set(ref(db, path), obj)
    },
    // Se suscribe a cambios en vivo; devuelve la función para cancelar.
    subscribe(onChange) {
      if (!onValue) {
        throw new Error('subscribe() requiere que se inyecte onValue de firebase/database.')
      }
      return onValue(ref(db, path), (snapshot) => {
        onChange(snapshot.exists() ? snapshot.val() : null)
      })
    },
  }
}
