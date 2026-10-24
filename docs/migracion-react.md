# Migración incremental a React

Base: `main` en `b039670`. Rama: `migracion-react`. Solo fases 0 y 1, sin publicar.

## Fase 0

- Vite 6, salida `dist/`, objetivo Safari 15. HTML fuente en la raíz.
- Los 14 módulos del núcleo se mueven a `src/core/`; imports actualizados.
- `store.subscribe` usa sus notificaciones existentes; `engine.subscribe` observa
  también las mutaciones directas que aún realiza la interfaz (incluidos arrays).
  No cambian algoritmos, claves ni formatos de persistencia.
- `scripts/build.mjs` delega en Vite. Generación de versión y SHELL completo de assets
  con hash en `dist/sw.js`. Caché `tai-v70`, conservando `tai-data`.
- `hosting.public=dist`; servidor local sirve esa salida con la CSP global de Firebase.
- Playwright: 17 rutas y sesión rápida completa de invitado, dos temas, Chromium y
  WebKit. 68 PNG de referencia a 393×852, comparación sin tolerancia de píxeles.
- Las capturas bloquean service workers para aislarlas de actualizaciones/cachés
  de ejecuciones previas de WebKit. Otros dos casos usan el worker real: instalación
  del shell, descarga completa y recarga offline con el mismo HTML y assets.
- Firebase se sustituye por configuración vacía en la frontera HTTP de e2e. Accesos
  requiere además propietario: se prepara `tai.acc:guest` solo en la fixture aislada.
- CI ejecuta e2e después de tipos/tests y antes de compilar/desplegar. Las referencias
  de otro SO se reconstruyen desde el commit de fase 0, nunca desde la app migrada.

Verificado: typecheck; **224 tests** (221 originales + 3 de suscripción); build;
validación de tarjetas (36 temas); **74 e2e**. `npm start` se ejecuta desde Playwright.
`npm run deploy` conserva su comando, pero no se ejecuta por la prohibición de publicar.
`public/style.css` y `firestore.rules` no cambian.

## Tamaños de JavaScript

Bytes minificados y gzip por archivo sumados (no incluye JSON de bancos, CSS o iconos).

| Estado | JS | gzip |
| --- | ---: | ---: |
| Base esbuild | 636365 | 187986 |
| Fase 0 Vite | 706120 | 189139 |

Vite avisa del chunk dinámico del SDK Firebase (>500 kB); sigue cargándose bajo demanda.
La fixture fija Math.random para que las dependencias no desplacen las preguntas elegidas.
Las capturas enmascaran únicamente el hash de compilación de Ajustes.
