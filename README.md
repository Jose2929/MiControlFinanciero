# Mi Control Financiero

PWA de finanzas personales — capa visual (UI/UX) construida con React, Tailwind CSS y Recharts, alimentada por datos de ejemplo en memoria. Sin Firebase ni persistencia real todavía: esta fase es solo la interfaz.

## Pantallas

Login/registro, Dashboard, Registro de gasto, Gastos, Cuentas y tarjetas, Deudas y créditos, Presupuestos, Notificaciones y Perfil. Navegación con bottom bar en móvil y sidebar en escritorio, modo oscuro por defecto con opción de modo claro.

## Desarrollo

```bash
npm install
npm run dev
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
