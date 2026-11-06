# Solicitud de generación de lotes de journeys TAI

Pasa la ruta a este archivo mediante `agent-explorer-batch --request tests/e2e/missions/tai-full-journeys-request.md` para generar un plan Playwright determinista. El generador debe inspeccionar `src/app/router`, `tests/e2e`, los componentes y la lógica de negocio antes de proponer cada paso. No inventes rutas, selectores, capacidades ni textos esperados: limita la tanda a controles y flujos comprobados en el código/DOM.

Entorno obligatorio: app `http://127.0.0.1:4187`, Firebase Auth Emulator `127.0.0.1:9099`, Firestore Emulator `127.0.0.1:8080`, proyecto `demo-tai-auth`, usuario ficticio `@example.test`, y `TAI_AGENT_EMULATOR_ONLY=1`. Nunca accedas a producción. El estado autenticado debe salir de `tests/e2e/README.md` y generarse bajo `test-results-explorer/run-*/auth.json`.

## Recorridos encadenados requeridos

1. **Estudio → planificación → progreso:** autenticar; consultar agenda; iniciar la actividad disponible; llegar al temario/material real; completar acciones que la interfaz expone; registrar autoevaluación si el flujo la ofrece; finalizar; comprobar progreso y actividad planificada; recargar; cerrar sesión y entrar de nuevo; verificar persistencia y aislamiento por UID.
2. **Examen y simulacro:** seleccionar una prueba existente; iniciar; contestar y cambiar respuestas; navegar atrás/adelante; recargar o interrumpir y reanudar solo si el comportamiento existe; finalizar; verificar resultado, explicaciones disponibles, historial y estadísticas.
3. **Active Recall:** marcar/estudiar un tema existente; registrar recuerdo por el control real; avanzar el reloj solo mediante mecanismo simulado de pruebas; completar revisiones vencidas; verificar siguiente fecha, estado y ausencia de duplicados tras repetir acciones, recargar y volver a entrar.
4. **Progreso y cuenta:** cambiar estado de varios temas por la interfaz; alternar filtros; consultar estadísticas; salir y entrar; comprobar conservación, conteos coherentes y no filtración entre usuarios.
5. **Cadena de impacto:** completar estudio, hacer un test con resultados reales, revisar la planificación que resulte según reglas actuales, hacer el repaso pendiente, repetir test, comparar estadísticas y validar todo tras nuevo login. Las siguientes acciones deben depender de los datos/resultados observados, no de datos inventados.

## Variantes adversariales de alto riesgo

Para cada journey viable incluye secuencia normal, repetición consecutiva e idempotencia de acciones, abandono en pasos críticos, reload, atrás/adelante, pérdida y recuperación de red, expiración/logout durante el flujo, dos pestañas con escrituras concurrentes, entradas vacías/límite/incorrectas y repetición tras completar. Prioriza combinaciones por pares entre cuenta × estado de actividad × transición; conserva al menos un caso de cada estado/transición de alto impacto. No generes permutaciones exhaustivas sin valor adicional.

Los escenarios deben incluir aserciones de estado final que crucen las funcionalidades y usar valores observados durante esa misma ejecución. Conserva semilla, plan generado, Action Tape, snapshots, capturas y salida para reproducir fallos. Agrupa pasos secuenciales del mismo recorrido para que Playwright los ejecute sin decisiones del modelo. El modelo solo propone planes nuevos; el replay no llama a Gemini. Marca explícitamente funciones no disponibles o escenarios bloqueados en vez de simular que pasaron.
