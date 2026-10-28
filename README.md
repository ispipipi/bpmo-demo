# BPMO · Demo H2D

Demo recorrible de una PMO de cumplimiento de la Ley 21.719 (caso ficticio Sanitaria Valparaíso). Aplicación estática, sin backend y con datos 100 % ficticios.

- **Stack:** Vite, React 18, TypeScript estricto, Tailwind 3, `react-router-dom` con `HashRouter`.
- **Estado:** `useReducer` + Context, persistido en `localStorage` (`npr_bpmo_h2d_demo_v1`).
- **Reloj de demo:** `D0 = 2027-01-12` en `src/config.ts`; solo los eventos E3 y E7 lo mueven.

## Comandos

```bash
npm ci
npm run dev        # desarrollo
npm test           # tests de dominio y almacenamiento
npm run build      # tsc + vite build
npm run check:js   # node --check sobre el JS generado
```

## Estructura

- `src/domain/`: tipos, catálogo de 22 procesos, seed, selectores (`derive/`), eventos E1 a E8 y operaciones de cada módulo. Todo puro y probado.
- `src/store/`: reducer, persistencia tolerante y bitácora.
- `src/pages/`, `src/components/`: pantallas y piezas de interfaz.
- `docs/QA.md`: matriz de aceptación (AC-01 a AC-25) y decisiones tomadas.

## Despliegue

`.github/workflows/deploy.yml` publica en GitHub Pages. El `base` de Vite es relativo (`./`), así que funciona en cualquier ruta estática. La página incluye `noindex`.
