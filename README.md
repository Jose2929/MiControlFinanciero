# Mi Control Financiero

PWA de finanzas personales — capa visual (UI/UX) construida con React, Tailwind CSS y Recharts, alimentada por datos de ejemplo en memoria. Sin Firebase ni persistencia real todavía: esta fase es solo la interfaz.

## Pantallas

Login/registro, Dashboard, Registro de gasto, Gastos, Cuentas y tarjetas, Deudas y créditos, Presupuestos, Notificaciones y Perfil. Navegación con bottom bar en móvil y sidebar en escritorio, modo oscuro por defecto con opción de modo claro.

## Presupuesto (sobres por ciclo)

Segundo apartado de la app, junto a Registro (selector **Registro | Presupuesto** en la barra superior). Convierte tu tabla de ingresos y gastos fijos en un plan mensual con sobres, y reutiliza los gastos que ya registras: un gasto baja su sobre sin capturarlo dos veces.

- **Resumen** — cuánto entra cada mes y cómo se reparte (tarjeta, digital, efectivo, ahorro), lo que tienes ahora y qué hay en cada cosa.
- **Sobres** — saldo de cada sobre y bolsillo por ciclo (todo acumula), ritmo de gasto, y los botones *Agregar*, *Gasto* y *Ajustar* (contar el sobre). Los ciclos cerrados también se pueden corregir.
- **Calendario** — el mes en una cuadrícula con un icono por día (sueldos, transferencias, cargos y pago de la TDC, ahorros) y palomitas de "ya lo hice".
- **Plan** — la tabla editable (ingresos y renglones por medio), fechas del ciclo y de la TDC, cuentas ligadas a cada medio, categorías ligadas a sobres, e importar/exportar JSON.

El plan vive en su propio nodo de Realtime Database, `households/{hid}/budget`, aparte del perfil del hogar. Para usarlo por primera vez:

1. Publica las reglas de `database.rules.json` (incluyen el bloque `budget`) en la consola de Firebase → Realtime Database → Reglas. Sin eso, las pantallas muestran "Falta un paso en Firebase".
2. En **Plan → Importar plan**, carga tu tabla en JSON (o captúrala a mano).
3. En **Plan → Cuentas de la app**, asigna cada cuenta a su medio; en **Plan → Categorías y sobres**, liga tus categorías a sobres.

Los datos reales del presupuesto no se suben a git: tu tabla vive en `budget-seed.json`, que está en `.gitignore` (igual que `import.json`). Las pruebas usan cifras ficticias.

## Desarrollo

```bash
npm install
npm run dev
npm test        # pruebas con Vitest
```

## Build de producción

```bash
npm run build
npm run preview
```

## Regenerar íconos de la PWA

```bash
npm run icons
```

## Despliegue en GitHub Pages

El workflow `.github/workflows/deploy.yml` compila y publica automáticamente en cada push a `main`. Solo se necesita activar una vez:

**Settings → Pages → Source: GitHub Actions**

La app queda publicada en `https://<usuario>.github.io/MiControlFinanciero/`.

## Estado del proyecto

Esta es la capa visual con datos mock (`src/data/mockData.js`). La siguiente fase conectará `src/context/FinanceContext.jsx` y `src/context/AuthContext.jsx` a Firebase (Auth + Firestore) sin tocar los componentes visuales.
