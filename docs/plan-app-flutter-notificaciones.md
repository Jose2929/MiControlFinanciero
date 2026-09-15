# Plan: app Android complementaria (Flutter) — detección de gastos vía notificaciones bancarias

> Este documento es una adaptación de un prompt más largo escrito originalmente
> asumiendo que MiControlFinanciero era una PWA Angular con Firestore. **No lo
> es** (ver sección 1). Cada sección de este documento fue verificada contra el
> código real del repo al 2026-09-13 (nombres de archivo y números de línea
> incluidos) — si en el futuro el código cambia y contradice algo escrito aquí,
> **el código gana**, este documento debe actualizarse, no al revés.

## 0. Cómo usar este documento

- Se trabaja **una fase a la vez**. No implementar varias fases de golpe.
- Para cada fase: explicar qué se va a modificar → implementar solo esa fase →
  compilar → probar → explicar cómo probarla en un teléfono real → mostrar qué
  resultado se debe observar → esperar confirmación antes de seguir.
- Si al llegar a una fase se descubre que depende de una **Decisión de
  arquitectura pendiente** (sección 2) que aún no se resolvió, **detente y
  pide que se resuelva antes de escribir código de esa fase**.
- No inventar estructura de Firebase, nombres de paquete de apps bancarias, ni
  URLs de producción que no estén confirmadas en este documento o en el código.
- Este documento vive en `docs/` porque el repo no tenía carpeta de
  documentación de planeación; no reemplaza al `README.md` (que además está
  desactualizado — ver sección 1).

---

## 1. Contexto real del proyecto (corrige los supuestos del prompt original)

El prompt original que dio origen a este documento asumía Angular + Firestore.
Ninguna de las dos cosas es cierta en este repo.

| Supuesto del prompt original | Realidad verificada en este repo |
|---|---|
| PWA Angular | React 18 + Vite, JSX (no TSX), `react-router-dom` con `HashRouter` — [src/App.jsx](../src/App.jsx) |
| Firestore (implícito) | Firebase Realtime Database — [src/lib/firebase.js](../src/lib/firebase.js) |
| Auth "si la PWA ya la usa" | Ya la usa: email/password + Google (`signInWithEmailAndPassword`, `signInWithPopup`+`GoogleAuthProvider`), sin auth anónima — [src/context/AuthContext.jsx:61-85](../src/context/AuthContext.jsx) |
| Modelo multi-usuario a construir | **Ya existe** un modelo de "hogar" (household) de 1+ personas — sección 3 |
| Colecciones separadas para gastos | Un único blob JSON por hogar — sección 3, y ver D1 en sección 2 |

Otros hechos reales relevantes:

- **Deploy**: GitHub Pages vía `.github/workflows/deploy.yml`, publicado en
  `https://jose2929.github.io/MiControlFinanciero/#/dashboard` (repo
  `github.com/Jose2929/MiControlFinanciero`, ramas `main`/`dev`, deploy solo en
  push a `main`). No hay dominio propio confirmado.
- **PWA hecha a mano**: `public/manifest.webmanifest` +
  `public/sw.js` (cache-first, `mcf-cache-v4`), registrado manualmente en
  `src/main.jsx`. No usa `vite-plugin-pwa`.
- **`README.md` está desactualizado**: dice literalmente que la app "no tiene
  Firebase ni persistencia real todavía" y que el plan es usar Firestore. El
  código real ya tiene Firebase Auth + Realtime Database funcionando end to
  end. No usar el README como fuente de verdad para nada relacionado con
  Firebase.
- **No existen** `firebase.json`, `.firebaserc`, `google-services.json`, ni
  ninguna app Android registrada en el proyecto de Firebase — solo hay una
  app **Web** (las 7 claves `VITE_FIREBASE_*` en `.env`/`.env.example`). Esto
  es una tarea real de la Fase 0/8, no un detalle menor (ver D4).

---

## 2. Decisiones de arquitectura pendientes ⚠️ leer antes de tocar Firebase

Ninguna fase que escriba en Firebase (8, 9, 10, 13) debe implementarse hasta
resolver lo que corresponda aquí. Si se llega a esa fase sin haber decidido,
**detente y pregunta** en vez de improvisar.

### D1 — 🔴 Conflicto de escritura sobre el blob `households/{hid}/profile` (BLOQUEANTE)

**Qué pasa hoy, verificado en código:**

Todo el dato financiero del hogar (cuentas, transacciones, deudas,
presupuestos, categorías propias, etc.) vive como **un solo nodo JSON** en
`households/{hid}/profile` ([src/lib/profileStore.js:84](../src/lib/profileStore.js)),
no como colecciones separadas. El cliente web:

1. Se suscribe en vivo a ese nodo completo con `onValue`
   ([profileStore.js:101](../src/lib/profileStore.js)).
2. Cada edición local dispara un autosave debounced de **1.5s**
   (`AUTOSAVE_DELAY_MS`, [FinanceContext.jsx:26](../src/context/FinanceContext.jsx))
   que hace `set()` del **árbol completo** reconstruido desde el estado de
   React en memoria ([FinanceContext.jsx:252-279](../src/context/FinanceContext.jsx)),
   no una escritura parcial.
3. **Ya existe** una salvaguarda de conflicto pensada para dos humanos con la
   web abierta a la vez ([FinanceContext.jsx:170-317](../src/context/FinanceContext.jsx)):
   si llega un cambio remoto mientras hay ediciones locales sin guardar
   (`dirty`), no se sobreescribe en silencio — se marca `remoteAhead` y el
   siguiente autosave pasa a `saveState: 'conflict'` en vez de guardar. La UI
   (`TopBar.jsx:79-111`) muestra entonces: *"Tu pareja guardó cambios que aún
   no has visto. ¿Qué quieres hacer con tus ediciones sin guardar?"* con dos
   botones: **"Recargar sus cambios (descarta los míos)"** o **"Sobrescribir
   con los míos"** (`saveProfile({ force: true })`,
   [TopBar.jsx:102](../src/components/layout/TopBar.jsx)).

**El riesgo real para Flutter no es "pérdida silenciosa" — es más sutil:**

Si Flutter escribe una transacción nueva (por notificación bancaria o registro
manual) justo mientras un usuario tiene la web abierta con ediciones sin
guardar, ese usuario verá el banner de conflicto de arriba **sin saber que lo
que está en juego es un gasto detectado por el teléfono, no solo "cambios de
la pareja"**. Si elige "Sobrescribir con los míos", el gasto que Flutter acaba
de insertar se pierde silenciosamente para ese guardado (aunque técnicamente
sigue en el histórico remoto hasta que se sobreescribe).

**Lo que Flutter debe hacer, sin excepción, para minimizar esto:**

- Nunca hacer `set()` del árbol completo. Escribir **siempre** con `update()`
  de rutas puntuales, exactamente como ya hace este mismo repo en
  [src/lib/household.js](../src/lib/household.js) (`ensureHousehold`,
  `joinHouseholdByCode` usan `update(ref(db), { [pathA]: valA, [pathB]: valB })`
  para escribir varias rutas atómicamente sin tocar el resto del árbol). Es un
  patrón ya probado en este código, no algo nuevo que inventar.
- La regla de seguridad en `profile` ([database.rules.json:37-40](../database.rules.json))
  es `.read`/`.write` sobre el nodo `profile` sin reglas hijas más
  restrictivas debajo — eso significa que una escritura granular a
  `households/{hid}/profile/transactions/{id}` **ya es válida hoy, sin tocar
  las reglas de seguridad**.

**Lo que queda como decisión abierta (no resolver aquí, resolver en la Fase 9):**

- ¿Se mejora la UI de conflicto para que distinga "tu pareja editó algo" de
  "el teléfono detectó un gasto" antes de ofrecer "sobrescribir"? (opción más
  robusta, más trabajo)
- ¿Se acepta el riesgo residual tal cual para un MVP privado de 2 usuarios con
  baja frecuencia de edición simultánea, y se mitiga solo con reintentos +
  aviso claro? (opción más simple, razonable para el MVP)

**Nota aparte, también verificada en código — namespace de ids:**

Los ids de transacción (`exp-1015`, `inc-1032`, etc.) **no son ids de Firebase
(`push()`)** — son un contador local en memoria del cliente web
(`localIdCounter`, [FinanceContext.jsx:28-35](../src/context/FinanceContext.jsx))
que arranca en 1000 y se "sube" al rehidratar según el mayor id visto. Si
Flutter genera ids con ese mismo esquema (`exp-<n>`) de forma independiente,
puede colisionar con uno que el contador web genere después. **Flutter debe
usar su propio prefijo de id** (p. ej. `and-<uuid>` o `and-<timestamp>`) para
garantizar que nunca colisione con los ids que genera el cliente web.

### D2 — ✅ Resuelto: Google Sign-In nativo + email/password

Decidido 2026-09-14, en la Fase 8. La cuenta real del usuario en la PWA usa
Google Sign-In (no tiene contraseña configurada), así que Flutter implementa
ambos métodos (`google_sign_in` + `firebase_auth`) contra el mismo proyecto
de Firebase. Verificado en el teléfono real: el botón "Iniciar sesión con
Google" funciona y el `uid` mostrado en la app coincide con el de la PWA.
Requirió resolver D4 (huella SHA-1 del keystore de debug registrada en la
consola de Firebase).

### D3 — ✅ Resuelto: monorepo, código en `mobile/`

Decidido 2026-09-13: el código Flutter vive en `mobile/` dentro de este mismo
repo (no un repo hermano). Proyecto creado con
`flutter create --org com.jose2929.micontrolfinanciero --project-name mobile
--platforms=android mobile` (solo plataforma Android, sin iOS/web/desktop).
`applicationId` resultante: `com.jose2929.micontrolfinanciero.mobile`.

### D4 — ✅ Resuelto: app Android registrada en Firebase

Decidido/hecho 2026-09-14, en la Fase 8. App Android registrada vía
`flutterfire configure -p siempreinvitados-api-dev -a
com.jose2929.micontrolfinanciero.mobile --platforms=android -y` (genera
`mobile/android/app/google-services.json` y `mobile/lib/firebase_options.dart`,
ambos fuera de git — ver `mobile/.gitignore`, mismo criterio que `.env`).
Huella SHA-1 del keystore de debug
(`32:D2:27:F7:F6:5F:5C:D7:61:FA:EE:A4:CD:0B:54:C7:64:F7:4F:0C`, obtenida con
`keytool -list -v -keystore ~/.android/debug.keystore`) agregada a mano en la
consola de Firebase para que funcione Google Sign-In nativo (D2). Falta
repetir esto con la huella de **release** cuando se llegue a la Fase 18.

### D5 — ✅ Resuelto: el candidato vive solo en memoria de Flutter

Decidido 2026-09-14, en la Fase 9. `src/pages/Notifications.jsx` sigue siendo
**100% derivado** (deudas próximas, presupuestos cerca del límite,
recurrentes pendientes — [FinanceContext.jsx:586-638](../src/context/FinanceContext.jsx)
— más el mock estático `STATIC_NOTIFICATIONS`) y **eso no cambia**: dado que
el usuario eligió confirmación en el mismo teléfono (notificación → abre app
→ modal → "Guardar" manual), el candidato detectado **no se escribe a
Firebase hasta que se confirma** — vive solo en memoria de Flutter
(`ConfirmMovementPage`, alimentada por los extras del `Intent` de la
notificación vía el canal `mcf/confirm_movement`, ver `MainActivity.kt`). Si
se cierra la app sin confirmar, se pierde el candidato en memoria, pero la
notificación de Android sigue en la bandeja y se puede volver a tocar. Esto
descarta el nodo `pendingTransactions` que este documento recomendaba
originalmente, y vuelve innecesaria la Fase 11 tal como estaba planteada (ver
esa fase): al no persistir nada pendiente, la PWA nunca necesita reflejar un
candidato a medias, solo la transacción ya confirmada (Fase 10), que ya le
llega sola por su suscripción `onValue` existente.

### D6 — ✅ Resuelto: apps objetivo confirmadas

Decidido 2026-09-13. El usuario listó: Santander, Google Wallet, PayPal, HSBC.
`packageName` reales, leídos directo del teléfono del usuario (Samsung
SM-S918B) vía `adb shell pm list packages` — **no inventados**:

| App | `packageName` |
|---|---|
| Santander México (Súper Móvil) | `mx.bancosantander.supermovil` |
| Google Wallet | `com.google.android.apps.walletnfcrel` |
| PayPal | `com.paypal.android.p2pmobile` |
| HSBC México | `mx.hsbc.hsbcmexico` |

Nota: son las apps mexicanas específicas instaladas en este teléfono (p. ej.
Santander "Súper Móvil" MX, HSBC México) — si el usuario cambia de banco o
usa la app de otro país, el `packageName` cambia y hay que releerlo del
dispositivo real, no asumirlo por el nombre comercial.

### D7 — "Segundo usuario del hogar" vs "Wear OS futuro"

¿Son el mismo caso de uso (la pareja del usuario también tendrá Wear OS) o
independientes? No afecta el MVP, pero sí el diseño de la Fase 14 (voz) y 15
(Wear OS). Pendiente de aclarar con el usuario, sin bloquear fases anteriores.

### D8 — Distribución del APK

Sideload manual (compartir el `.apk` directamente) vs Play Console en modo
"internal testing" (requiere cuenta de desarrollador de Google, US$25 una
vez). Se decide en la Fase 18, no bloquea nada antes.

---

## 3. Modelo de datos real (referencia rápida — no repetir en cada fase)

### Household (ya existe, no reconstruir)

- `users/{uid}/householdId` → apunta al hogar del usuario.
- `households/{hid}/meta` = `{ name, createdAt, createdBy }`.
- `households/{hid}/members/{uid}` = `{ role: 'owner'|'member', name, email, joinedAt }`.
- `households/{hid}/inviteCode` + `inviteCodes/{code}` = `{ householdId, createdAt, createdBy }`.
- Alta automática de hogar al primer login: `ensureHousehold(uid, profile)`
  ([src/lib/household.js:30](../src/lib/household.js)), rol `owner`.
- Unirse con código: `joinHouseholdByCode(uid, profile, code)`
  ([src/lib/household.js:81](../src/lib/household.js)), rol `member`.
- **Esto ya satisface** el requisito de "app privada para dos usuarios" del
  prompt original — la app Flutter se integra con este modelo, no construye
  uno propio.

### El blob financiero: `households/{hid}/profile`

Un único nodo JSON (no colecciones separadas) con estas claves, cada una un
**mapa por id** (no un array): `accounts`, `transactions`, `debts`,
`budgets`, `customCategories`, `incomeProfiles`, `recurringBills`,
`recurringConfirmations`, `debtConfirmations`, `readIds`, `idCounter`,
`budgetTotalLimit`, `meta`. Serializado/deserializado en
[src/lib/profileSchema.js](../src/lib/profileSchema.js).

**Campos verbatim por tipo de transacción** (todas comparten
`id, type, amount, accountId, note, date, createdBy`; `note` es el único
campo de texto libre — **no existe** `description` ni un booleano `recurring`
en la transacción):

- `expense` ([FinanceContext.jsx:655-674](../src/context/FinanceContext.jsx)):
  `+ categoryId, subcategoryId, counterAccountId, convertedToMsi?`
- `income` ([FinanceContext.jsx:680+](../src/context/FinanceContext.jsx)):
  `+ incomeSourceId` (+ campos variables según el modo del perfil de ingreso:
  `grossAmount/ivaPercent/ivaAmount/isrPercent/isrAmount` en modo `resico`, o
  `payMode/hours/hourlyRate` en modo `hourly`)
- `debt_payment`: `+ debtId, categoryId`
- `saving_movement`: `+ counterAccountId, categoryId, direction: 'deposito'|'retiro'`
- `adjustment`: `amount` con signo, sin categoría

**Funciones de creación/edición/borrado** (todas en `FinanceContext.jsx`,
todas mutan el estado de React — la app Flutter **no** las reutiliza
directamente, pero debe replicar su efecto sobre `accounts` si escribe
directo a Firebase — ver `applyExpenseEffect` abajo):
`addExpense:655`, `addIncome:680`, `registerSavingMovement:804`,
`addBalanceAdjustment:852`, `deleteBalanceAdjustment:875`,
`registerDebtPayment:887`, `updateTransaction:938`, `deleteTransaction:991`,
`addExpenseDeferred:1025` (MSI → crea una deuda, no una transacción normal),
`convertExpenseToMSI:1062`.

**Efecto sobre el saldo de una cuenta** — fórmula exacta
([FinanceContext.jsx:42-53](../src/context/FinanceContext.jsx)), que Flutter
debe replicar igual si escribe un gasto directo a Firebase (para no
desincronizar la lógica de negocio entre Dart y JS):

```js
// cuenta type 'credito': sube/baja `used`. cualquier otro type: baja/sube `balance`.
// counterAccountId (opcional, solo si esa cuenta es 'credito'): efecto inverso sobre su `used`.
```

### Cuentas (`accounts`) — entidad real, no un string de "método de pago"

`{ id, name, bank, type, last4, gradient, balance }`, con
`type ∈ {debito, credito, efectivo, ahorro}`. `credito` añade `used, limit`;
`ahorro` puede tener `goal`. Las transacciones referencian `accountId` (y
opcional `counterAccountId`) — **nunca** un string libre de "método de pago".

### Categorías (`src/lib/categories.js`, lista cerrada + `customCategories` por hogar)

`comida, transporte, renta, entretenimiento, salud, compras, servicios, otros,
bebe` (sub: `panales, ropa-bebe, guarderia, salud-bebe, juguetes`),
`mascotas` (sub: `alimento-mascota, veterinario, accesorios-mascota,
estetica-mascota`).

### Recurrentes — plantilla separada, no una transacción con flag

`recurringBills` = `{ id, name, description, categoryId, estimatedAmount,
dueDay, accountId }`. Confirmar un periodo llama `addExpense` normal y
registra `{ billId, period, transactionId, amount, date }` en
`recurringConfirmations`. No hay booleano "es recurrente" en la transacción.

---

## Fase 0 — Instalación del entorno de desarrollo

**Verificado en esta máquina (macOS) el 2026-09-13: nada de esto está
instalado hoy** salvo un JDK Temurin 11, que probablemente no baste solo
(Android Gradle Plugin reciente suele pedir JDK 17+; el JDK embebido de
Android Studio suele ser la vía más simple).

Checklist real de instalación (no solo confirmación):

- [ ] Flutter SDK (incluye Dart, no se instalan por separado) → `flutter doctor`
- [ ] Android Studio — necesario aunque el código Dart se termine editando en
  otro editor (VS Code + extensión Flutter): es la vía estándar para el
  Android SDK, `adb`/platform-tools, el emulador (AVD Manager) y aceptar las
  licencias del SDK.
- [ ] Kotlin — **no** se instala aparte, viene con el Android Gradle
  Plugin/Android Studio, se usa directo al escribir el módulo nativo (esto ya
  lo señalaba bien el prompt original).
- [ ] Confirmar qué JDK usará Flutter/Gradle (el embebido de Android Studio,
  en vez de depender del Temurin 11 existente).
- [ ] Dispositivo Android físico (recomendado sobre emulador) para probar
  `NotificationListenerService` con apps bancarias reales instaladas — más
  representativo que un emulador con imagen Play Store.
- [ ] Firebase CLI + FlutterFire CLI (`dart pub global activate
  flutterfire_cli`, luego `flutterfire configure`) — resuelve parte de D4:
  registra la app Android en el proyecto de Firebase real y genera
  `google-services.json`.
- [ ] Resolver **D3** (dónde vive el código) antes de correr `flutter create`.

**Salida de esta fase:** `flutter doctor` sin errores bloqueantes para
Android. **Detenerse aquí y confirmar antes de seguir.**

## Fase 1 — Proyecto Flutter mínimo + estructura de carpetas

Objetivo: proyecto compilable, instalable en un teléfono real, sin lógica de
notificaciones todavía. Estructura razonable (sin sobrearquitecturar):

```
lib/
  core/
  models/
  services/
  repositories/
  features/
    notifications/
    settings/
```

Al terminar: app mínima instalada en un teléfono real. **Detenerse y explicar
cómo probarla.**

## Fase 2 — `NotificationListenerService` en Kotlin + puente a Flutter

Responsabilidad del servicio Kotlin: recibir notificaciones del sistema,
obtener `packageName` + datos de la notificación, enviarlos a Flutter vía
`MethodChannel`/`EventChannel`. **No** enviar nada a Firebase todavía. Definir
un `NotificationEvent` interno (`packageName, appName, title, text,
timestamp`) — uso solo interno para procesar, nunca se sube a Firebase.
Diseñar desacoplado para poder cambiar el parser después sin tocar el
servicio. **Resolver D6 antes de esta fase** (packageNames reales del
usuario). Al terminar: instalar en teléfono real, conceder acceso a
notificaciones, recibir una de prueba, verla en logs de desarrollo.
**Detenerse y explicar la prueba.**

## Fase 3 — Selector de apps monitoreadas

UI para activar/desactivar por `packageName` (nunca por nombre visible).
Config local `MonitoredApps: { packageName, enabled }`. El listener descarta
de inmediato cualquier notificación de un paquete no seleccionado —
demostrar ambos casos (app seleccionada se procesa, no seleccionada se
ignora).

## Fase 4 — Motor de parsing local

`NotificationEvent → ParsedTransaction`. Extensible por banco
(`SantanderParser`, `BBVAParser`, `GenericParser`, etc. — nombres reales
pendientes de D6, no asumir). El texto original **no** se guarda
permanentemente. `ParsedTransaction` debe usar los mismos nombres de campo
que el modelo real de la sección 3 en la medida de lo posible
(`amount, accountId?, categoryId?, note`), no inventar campos nuevos como
`merchant`/`paymentMethod` sueltos si eventualmente van a mapear a
`accountId`/`categoryId` reales del hogar.

## Fase 5 — Detección de tipo de movimiento

`expense | income | unknown`. Nunca registrar automáticamente un `unknown`.

## Fase 6 — Deduplicación (fingerprint local)

Combinar app origen + timestamp + monto + comercio/concepto + hash local.
Conservar el fingerprint localmente un período razonable. No asumir que el
texto de la notificación es siempre idéntico entre reintentos del banco.

## Fase 7 — Notificación propia

Al detectar un movimiento válido, mostrar una notificación propia de la app
(no modificar la del banco) con un botón para abrir el flujo de confirmación.

## Fase 8 — Autenticación compartida con la PWA — resuelve D2/D4

Login en Flutter contra el mismo proyecto Firebase, mismo `uid` que la PWA.
Requiere D4 resuelto (`google-services.json`, SHA-1 si aplica Google
Sign-In). Sin esto, ninguna fase posterior que toque Firebase puede
avanzar.

## Fase 8.5 — ✅ Implementada: wrapper de la PWA (WebView con sesión compartida)

Añadida 2026-09-14, después de la Fase 13 (por prioridad explícita del
usuario, ver commits `2820528`/`87d39f1`/`b2b807d`/`10cf50f`). La app
Android tiene una pestaña "App" (`HomeShell`, primera/default) que carga
la PWA completa en un WebView, con sesión de Firebase Auth compartida
automáticamente con el login nativo (Fase 8) — sin pedir credenciales de
nuevo. Puente en `src/lib/firebase.js`
(`window.__mcfNativeSignIn`/`window.__mcfAuthUid`) + lógica nativa en
`mobile/lib/features/webview/pwa_webview_page.dart`. Detalle: Google
bloquea su propio `signInWithPopup` dentro de WebViews embebidos, así que
la única vía viable es reproducir el idToken de Google ya obtenido
nativamente — no un login nuevo dentro del WebView.

## Fase 9 — Confirmación/edición en el teléfono — resuelve D5

Pantalla de revisión antes de guardar: tipo, monto, comercio/nota, cuenta
real del hogar (`accountId`, de la lista real de `accounts`), categoría real
(de `categories.js` + `customCategories` del hogar, no una lista inventada),
fecha. El usuario puede editar todo antes de confirmar. Aquí se decide
formalmente dónde viven los candidatos pendientes (D5).

## Fase 10 — Escritura en Firebase — resuelve D1

Escritura con `update()` de rutas puntuales (patrón de
`src/lib/household.js`, sección D1), namespace de id propio (`and-...`), sin
tocar reglas de seguridad (ya cubren sub-rutas de `profile`, o el nodo nuevo
de D5 si quedó fuera del blob). Replicar `applyExpenseEffect` (sección 3) si
se ajusta `balance`/`used` de la cuenta directamente.

## Fase 11 — Reflejo en la PWA

**Alcance reducido tras la Fase 9 (ver D5):** al resolverse D5 con "el
candidato vive solo en memoria de Flutter, nada pendiente se persiste", ya
no hace falta diseñar un nuevo tipo de alerta "movimiento detectado
pendiente" en `Notifications.jsx`/`FinanceContext.jsx` — esa página sigue
siendo 100% derivada, sin cambios. Lo único que le llega a la PWA es la
transacción **ya confirmada** que escriba la Fase 10, y eso ya le llega solo
por su suscripción `onValue` existente (`FinanceContext.jsx`), sin trabajo
adicional. Esta fase queda entonces como una verificación (¿se ve bien el
movimiento nuevo en `/gastos` y `/cuentas` tal como llega?), no como
desarrollo nuevo — rutas reales del `HashRouter`: `/gastos`, `/cuentas`,
`/notificaciones`, `/perfil`.

## Fase 12 — Funcionamiento offline

Estados `pending / synced / failed`. Reintentos seguros. Nunca perder un
movimiento por falta de conexión; nunca duplicar al reconectar (reutilizar la
deduplicación de la Fase 6).

## Fase 13 — Registro manual desde Android

Mismo modelo/repositorio que el gasto detectado. Campos mínimos: monto,
categoría real, cuenta real (no "método de pago" libre), nota opcional,
fecha.

## Fase 14 — Preparación para entrada por voz (sin implementar aún)

Interfaz abstracta `InputSource` (`ManualInputSource`,
`NotificationInputSource`, futuros `VoiceInputSource`,
`WearOSInputSource`). No implementar voz todavía.

## Fase 15 — Preparación arquitectónica para Wear OS (sin desarrollar aún)

Solo diseño de interfaces que permitan añadir Wear OS después sin reescribir
la app. No construir una app Wear OS completa. Aclarar D7 antes de diseñar
esta fase a fondo.

## Fase 16 — ✅ Revisada: seguridad y privacidad (revisión final)

No enviar texto completo de notificaciones a Firebase ni guardarlo
innecesariamente. No credenciales ni secretos en código. Revisar que los
logs de desarrollo no impriman de forma persistente montos/comercios reales.
Confirmar que las reglas de `database.rules.json` siguen siendo correctas
tras cualquier nodo nuevo (p. ej. el de D5).

**Auditoría (2026-09-14):**

- **Secretos**: `google-services.json`/`firebase_options.dart` correctamente
  en `.gitignore`; el único valor fijo en código (`googleServerClientId`)
  es un Web Client ID de OAuth, público por diseño, no un secreto.
- **`database.rules.json`**: sin cambios necesarios — D5 no creó ningún
  nodo nuevo (el candidato vive solo en memoria hasta confirmarse), y
  `TransactionWriter` escribe únicamente bajo `households/$hid/profile/...`,
  ya cubierto por la regla existente de `profile`.
- **Hallazgo corregido — texto crudo a Firebase**: `GenericParser` (usado
  como fallback por Santander sin calibrar y de lleno por HSBC/PayPal/
  Google Wallet, aún sin regex propio) ponía el texto completo de la
  notificación como `note`, que podía llegar tal cual a Firebase si el
  usuario no lo editaba antes de guardar. Se corrigió para dejar `note`
  en `null` en ese fallback — la detección de monto/tipo no se ve
  afectada.
- **Hallazgo corregido — logs con datos reales**: varios `debugPrint`/
  `Log.d` imprimían título/texto crudo o monto/nota ya parseados sin
  protección, visibles en `adb logcat` incluso en un build de release.
  Se protegieron con `kDebugMode` (Dart)/`BuildConfig.DEBUG` (Kotlin) —
  verificado con un build release real: cero rastro de esos datos en
  logcat tras disparar el flujo completo.

## Fase 17 — Pruebas

Parser (gasto válido, abono válido, irrelevante, monto con coma/punto,
comercio desconocido, notificación duplicada/modificada), apps monitoreadas
(seleccionada/no seleccionada), Firebase (autenticado/no autenticado,
pérdida y recuperación de conexión, doble sincronización), PWA (abrir,
confirmar, cancelar, editar), offline (detectar sin internet, cerrar app,
reconectar, sincronizar).

## Fase 18 — Build de producción / distribución privada

APK debug y release firmado. Resolver D8 (sideload vs Play internal
testing). Sin publicar en Google Play todavía.

---

## Apéndice A — Restricciones NO / SÍ

**NO:**
- Migrar React a Flutter, ni reescribir la PWA.
- Crear un backend adicional si Firebase ya resuelve la necesidad.
- Enviar notificaciones completas (texto crudo) a Firebase.
- Procesar apps no seleccionadas por el usuario (WhatsApp, Gmail, etc.).
- Registrar automáticamente movimientos `unknown` o de baja confianza.
- Publicar en Play Store durante el MVP.
- Desarrollar Wear OS completo todavía (solo preparar arquitectura).
- Hacer `set()` de árbol completo desde Flutter sobre `profile` (ver D1).
- Reutilizar el esquema de id secuencial `exp-<n>`/`inc-<n>` del cliente web.

**SÍ:**
- Flutter como app móvil, Kotlin solo para APIs nativas de Android.
- Firebase (mismo proyecto, mismo Auth, misma Realtime Database) como único
  backend.
- Procesamiento local de notificaciones, arquitectura modular, offline-first,
  deduplicación.
- Integrarse con el modelo de household/accounts/categories ya existente en
  vez de reconstruirlo.
- Preparación (sin implementar) para voz y Wear OS.
- Una fase a la vez, con parada explícita ante cualquier decisión
  arquitectónica nueva.

## Apéndice B — Huecos de información pendientes (lista viva)

- [x] D2 — resuelto: Google Sign-In nativo (además de email/password) —
  mismo `uid` verificado contra la PWA en el teléfono real.
- [x] D3 — resuelto: carpeta `mobile/` dentro de este repo (monorepo).
- [x] D4 — resuelto: app Android registrada en Firebase
  (`com.jose2929.micontrolfinanciero.mobile`), huella SHA-1 del keystore de
  debug agregada en la consola.
- [x] D5 — resuelto: el candidato detectado vive solo en memoria de Flutter
  hasta confirmarse (ver sección D5).
- [x] D6 — resuelto: Santander, Google Wallet, PayPal, HSBC (`packageName`
  confirmados leyendo el teléfono real, ver sección D6).
- [ ] D7 — si el "segundo usuario del hogar" y "Wear OS futuro" son el mismo
  caso de uso.
- [ ] D8 — sideload vs Play internal testing (se decide en la Fase 18, no
  bloquea nada antes).
