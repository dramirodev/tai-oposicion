# Migración incremental a React

Base: `main` en `b039670`. Rama: `migracion-react`. Solo fases 0 y 1, sin publicar.

## Fase 0

- Vite 6, salida `dist/`, objetivo Safari 15. HTML fuente en la raíz.
- Los módulos se redistribuyen en `src/core/` (tipos/configuración), `src/domain/`
  (motor y reglas de estudio), `src/infra/` (acceso, persistencia, red y caché) y
  `src/vistas/` (React, pantallas y puente legacy). Solo cambian rutas de importación;
  se conservan formatos y lógica.
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

`public/style.css` y `firestore.rules` no cambian.

## Fase 1

- React 19 y React Router 7 `createHashRouter`; todas las rutas usan LegacyRoute.
- Layout conserva la barra y el recorte `GUEST_ROUTES`, integra menú, banner de red,
  foco de navegación y el proveedor React de toast/ask/notice.
- El puente crea un contenedor por navegación, conserva el HTML y su cleanup y evita
  que una carga tardía escriba en la pantalla nueva.
- El recorte de navegación escucha cambios del modo local y de la cuenta. La recuperación
  de IndexedDB se memoiza por cuenta y vuelve a ejecutarse al cambiarla.
- Registro/actualización del service worker, flush de progreso, guardado y reanudación
  de sesión, prefetch y sincronización quedan en el arranque del puente.
- 3 pruebas de diálogos, 1 de aislamiento/cleanup, 1 de recuperación por cuenta y 6 e2e (Chromium y WebKit) para
  guardar/reanudar progreso, menú, foco, conectividad y rutas de invitado.

Verificado: typecheck; **228 tests**; build; tarjetas (36 temas); **80 e2e**, incluidas
68 comparaciones PNG exactas contra la fase 0. `npm start` compila y sirve la app mediante
Playwright. La revisión independiente no encontró defectos accionables. No se ejecutó
`npm run deploy` porque publicaría el sitio.

La fixture fija Math.random para que las dependencias no desplacen las preguntas elegidas.
Las capturas enmascaran únicamente el hash de compilación de Ajustes.

## Verificación final

Fase 0: typecheck; **224 tests** (221 originales + 3 de suscripción); build;
validación de tarjetas (36 temas); 74 e2e.
Fase 1: typecheck; **228 tests**; build; validación de tarjetas (36 temas);
**80 e2e**, incluidas 68 comparaciones PNG exactas contra la fase 0. `npm start`
compila y sirve la app durante Playwright. `npm run deploy` conserva su comando,
pero no se ejecutó porque publicaría el sitio.

La revisión independiente no encontró defectos accionables. La pantalla se monta de
forma asíncrona en React; por eso dos pruebas esperan a que React confirme `#simtabs`
antes de interactuar. Conservan las mismas pulsaciones y comprobaciones posteriores.
No se identificó otra diferencia funcional en las rutas o capturas verificadas.

## Tamaños de JavaScript

Bytes minificados y gzip por archivo sumados (no incluye JSON de bancos, CSS o iconos).

| Estado | JS | gzip |
| --- | ---: | ---: |
| Base esbuild | 636365 | 187986 |
| Fase 0 Vite | 706120 | 189139 |
| Fase 1 React | 1027456 | 291951 |

Vite avisa del chunk dinámico del SDK Firebase (>500 kB); sigue cargándose bajo demanda.
