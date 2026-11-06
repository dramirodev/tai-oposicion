# Simplificación y cinco temas · evidencia

[Galería comparable](gallery.html): capturas reales de Inicio con los mismos datos, Chromium, 390 × 900 px y modo claro. Las cinco imágenes son ejemplos representativos, no maquetas ni imágenes del selector. El selector utiliza muestras CSS ligeras.

## Cobertura reproducible

| Comprobación | Resultado local | Alcance |
|---|---|---|
| Matriz inicial | 40/40 | 5 temas × claro/oscuro × 390/1440 px × Chromium/WebKit; 17 rutas, quiz, corrección, diálogo y resultado |
| Revalidación integrada 1.2.0 | 150/150 | Regresiones afectadas, 68 capturas de rutas, selector, offline y 20 casos dinámicos de respuesta/error/diálogo a 320 px |
| Contenido técnico real | 20/20 | `AT306-P1-40`, Java multilínea, corrección real, 5 temas × 2 modos × 2 motores a 320 px |
| Preferencias | 2/2 motores | Cinco opciones, teclado, modo Sistema, navegación/recarga, anchos 320/390/768/1440; igualdad de progreso y sesión |
| Métricas tras integración | 10/10 | Zoom CSS200%,320/768/1440 y15 respuestas; ver UX-THEMES-005/006 |
| Auth local | 2/2 | Recarga protegida, cambio de cuenta, tema local por cuenta y lectura de recuerdo histórico conservada |
| Check tras integrar main c7d6f05 | 1177 aprobadas / 31 omitidas | Arquitectura, ESLint, crecimiento de ignores, TypeScript y Vitest |

`coverage.json` conserva combinaciones, estados y límites. Las evidencias iniciales preceden a la última integración de citas/métricas; el registro canónico `../../journey-audit-report.md` y la PR enlazada allí recogen la revalidación posterior y el resultado remoto final. No se atribuyen los conteos de una fase a otra.

## Repetición

- `npm run check` y `npm run build`.
- `npx playwright test tests/e2e/visual-themes.spec.ts` para la matriz completa y estados; los artefactos van a `test-results/five-themes/`.
- `TAI_AGENT_EMULATOR_ONLY=1 npm run test:e2e:supertest`.
- `TAI_AGENT_EMULATOR_ONLY=1 node scripts/e2e/run-supertest.mjs --auth-journey`.
- `npm run test:e2e:ci` reconstruye la referencia visual aprobada y ejecuta la suite completa en el runner.

Auth y Firestore se limitan a `demo-tai-auth`, `127.0.0.1:9099/8080` y app `127.0.0.1:4187`, con cuentas `@example.test`. Antes de preparar identidades se espera la inicialización de la pantalla, se valida configuración servida y GET de conectividad observados. Esas lecturas explícitas no se presentan como tráfico interno del SDK; el guard fail-closed limita además todo su tráfico real. No hubo datos ni escrituras de estudiantes reales.

## Límites

No se usaron dispositivos físicos ni lector de pantalla. Contraste se comprueba en tokens semánticos y controles seleccionados, junto con foco/teclado, semántica y reflujo de los recorridos; no equivale a certificación WCAG global. El inventario completo de estados de toda la plataforma sigue bajo ATE-005 y UX-009; esta entrega no cierra esas auditorías históricas. Los roles/permisos se verifican con Emulator y lógica compartida, sin multiplicar toda la suite por cinco identidades. No se ejecutó Gemini.

Las capturas históricas de otras auditorías se conservan; las regeneradas por los tests se archivan localmente en `test-results/`. Se versionan sólo cinco previews ligeros, la galería y esta matriz.
