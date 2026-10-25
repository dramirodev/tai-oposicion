# Migración React: fases 0 y 1

Especificación: solicitud del usuario de 2026-10-24. Base: main, b039670.
Ejecución en la rama migracion-react; exactamente un commit por fase. Sin push, merge ni despliegue.

## Restricciones

- Núcleo en src/core: solo movimientos/imports y suscripción observable en store/engine.
- Conservar persistencia, URL, IDs, clases, CSS global, CSP y objetivo safari15.
- Vitest mantiene todas sus comprobaciones; los imports y la entrada HTML cambian de ubicación.
- Ninguna credencial, cambio de reglas, Zod ni migración de pantallas a componentes.

## Fase 0

1. Medir y comprobar la base (typecheck, 221 tests, build, tarjetas).
2. Mover los 14 módulos de núcleo, actualizar imports y probar subscribe/cancelación.
3. Vite 6: index.html fuente, scripts/build.mjs, dist, version.json y SHELL con todos los assets con hash.
4. Servidor con cabeceras de Firebase, hosting.public=dist y CI con Playwright tras tipos/tests.
5. E2E: 17 rutas, sesión de invitado completa, dos temas, viewport 393×852, errores de página/consola y referencias PNG.
6. Pasar todos los controles y revisar el diff antes del primer commit.

## Fase 1

1. React 19 y React Router 7: main.tsx, App, Layout y LegacyRoute.
2. Extraer navegación del puente: contenedor DOM separado de React, cleanup al salir y protección de cargas pendientes.
3. Layout conserva barra y controles; proveedor React conserva API de toast/ask/notice y accesibilidad.
4. Conservar arranque, guardados, reanudación, sincronización y actualizaciones.
5. Pasar controles y comparar las mismas referencias sin regenerarlas. Medir tamaño, revisar y segundo commit.

## Revisión

Prestar atención a navegación durante cargas, cierre de confirmaciones al salir, cambios de cuenta,
mutaciones directas de Run, sesión persistida, acceso de invitado y caché sin conexión.
La pantalla acceso exige propietario además de tai.dev=1: la fixture usa tai.acc:guest local,
sin autenticar ni escribir en Firestore. El límite externo firebase-config se sustituye por {} en e2e.
