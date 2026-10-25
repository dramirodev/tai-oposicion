# Inventario y regresión: mejoras de estudio

## Base comprobada

- Rama de trabajo: `mejoras-estudio`, worktree aislado.
- HEAD base: `631a7f5` (merge de migración); árbol idéntico al commit final `3d330e6` de `migracion-react`.
- No había cambios versionados o sin seguimiento en la rama de trabajo al empezar. El plan local está ignorado por Git y se mantiene sin modificar.
- El motor real está en `src/core/application/legacy-engine.ts`, con reglas heredadas restantes en `src/legacy/logic.ts` y progreso en `src/adapters/local/legacy-store.ts`. `src/app/legacy-router.ts` conecta las pantallas `src/features/*/legacy.ts`.

## Mapa de contratos existente

| Responsabilidad | Ruta real | Contrato / formato vigente |
|---|---|---|
| Sesión y respuestas | `src/core/application/legacy-engine.ts` | `Run` con `items`, `idx`, `ans`, `times`, `secs`, `paused`, revisión; sesiones `test`, `rev`, `sim`. Guardado resumido en `tai.run:<cuenta|guest>`. |
| Progreso agregado | `src/adapters/local/legacy-store.ts` | `tai.v1:<cuenta|guest>`; `stats` usa array posicional, `sessions` resultado agregado, `cards` array posicional. `importAll` fusiona y no reemplaza la copia actual. |
| Recuperación local | `src/adapters/local/legacy-store.ts` | respaldo IndexedDB `tai-mirror`, claves `state:<cuenta|guest>`; recuperación restringida al propietario para copias sin ámbito. |
| DTO y mappers de progreso | `src/adapters/local/dto/progress.ts`, `src/adapters/local/mappers/{stats,session,card,report,preferences,progress}.ts` | Traducción explícita DTO ↔ dominio; el historial agregado no contiene eventos por respuesta. |
| Puertos | `src/core/ports/{ProgressRepository,SessionRepository,BankRepository,SyncGateway,AccessGateway,Clock,OfflineCache}.ts` | Modelos de dominio para APIs nuevas; el motor puente conserva accesos heredados directos. |
| Adaptador de banco | `src/adapters/http/legacy-data.ts`, `src/adapters/http/bank-repository.ts`, `src/adapters/http/mappers/question.ts` | URLs públicas `data/*.json`, `cards/*.json`; caché por tema. |
| Sincronización / reglas | `src/adapters/firebase/legacy-sync.ts`, `src/adapters/firebase/sync-facade.ts`, `src/adapters/firebase/legacy-sync-state.ts`, `firestore.rules` | stats por tema, sesiones y documentos `cfg/*`; las reglas existentes se leen y no se modifican en fase 0. |
| Composición y ciclo de vida | `src/app/{main.tsx,App.tsx,Layout.tsx,LegacyRoute.tsx,legacy-router.ts}` | Hash router React y puente legado; registro SW, guardado al ocultar/cerrar, sincronización y recuperación pendientes. |
| Presentación / diálogos | `src/shared/presentation/*`, `src/shared/ui/{dialogs.tsx,dialog-store.ts,legacy-dom.ts}` | Formatos reutilizables y proveedor de diálogos; no hay sistema de ayuda específico disponible todavía. |
| Pantallas heredadas | `src/features/{home,access,cards,settings,stats,trainers}/legacy.ts`, más handlers en `src/app/legacy-router.ts` | Conservan IDs, clases y comportamiento del HTML/CSS actual. |
| Pruebas | `tests/*.test.js`, `tests/domain/*.test.js`, `tests/adapters/*.test.js`, `tests/e2e/*.spec.ts` | Vitest cubre motor/store, mappers e interfaz jsdom; Playwright recorre rutas en Chromium y WebKit. |

## Matriz de regresión inicial

| Área | Evidencia automatizada inicial | Comprobación adicional prevista |
|---|---|---|
| Tests, quizzes, simulacros, penalización y puntuación | `tests/app.test.js`, `tests/logic.test.js`, `tests/scored.test.js`, `tests/regressions.test.js`; 17 rutas E2E | Recorrido integral con pendientes, consultas y finalización en fase 7 |
| Falladas, dudosas, rachas y repaso | `tests/store.test.js`, `tests/regressions.test.js`, `tests/domain/spaced-repetition.test.js` | Coherencia tras responder/revelar y revisar en fase 7 |
| Tarjetas | `tests/cards.test.js`, `tests/domain/flashcards.test.js`, `tests/store.test.js` | Preservación de progreso antiguo y posterior a los cambios |
| Supuestos, trampas, lectura, relámpago y temario | `tests/app.test.js`, `tests/logic.test.js`, `tests/domain/traps.test.js`; Playwright rutas | Navegación, estado y funcionamiento offline |
| Cuenta, invitado, acceso y sincronización | `tests/account-recovery.test.js`, `tests/sync.test.js`, `tests/mappers/access.test.js` | Aislamiento de ámbitos y listeners cancelados; sync real se reportará aparte |
| Copias, importación y recuperación antigua | `tests/store.test.js`, `tests/mappers/progress.test.js`, `tests/regressions.test.js`; `tests/legacy-fixtures.test.js` | Importación repetida, IndexedDB y cuenta en fase 7 |
| Offline, SW, CSP y rutas | `tests/sw.test.js`; E2E service worker en Chromium/WebKit | Prueba física Safari/iPadOS no sustituida por emulación |
| Subrayado, confianza, motivo, “No lo sé” y “Ver solución” | Sin contrato antes de la implementación | Pruebas de transición de intento + E2E en fases 2–3 |
| Ayuda, explicación editorial y exportación IA | Sin contrato antes de la implementación | Cobertura y revisión editorial/manual en fases 2A, 4 y 6 |
| Analíticas y recomendaciones | Estadísticas agregadas existentes; sin historial por intento | Umbral, denominadores, abstención y cálculos reproducibles en fase 5 |

## Archivos previstos por responsabilidad

Los destinos concretos se ajustarán al código real, sin introducir versiones paralelas del motor.

- `src/core/domain/attempts/*`: transiciones puras, estados, eventos y cómputo de tiempo.
- `src/core/application/attempts/*`, `src/core/ports/AttemptRepository.ts`: orquestación y contrato de persistencia idempotente.
- `src/adapters/local/*` y `src/adapters/firebase/*`: persistencia por ámbito, recuperación, sincronización y borrado versionado, conservando las claves/DTO anteriores.
- `src/features/{test,quiz,sims,results,stats,settings,home}/**`: ayuda, estados de pregunta, señales de práctica, panel analítico y exportación; pantallas aún heredadas siguen pasando por `legacy.ts`.
- `src/shared/{ui,presentation}/**`: controles accesibles de ayuda, marcas, explicaciones y formatos ya preparados.
- `tests/attempts/**`, `tests/features/**`, `tests/e2e/**`, `tests/fixtures/**`: contratos por capa, integraciones y casos antiguos.
- `docs/ARQUITECTURA.md`, `docs/ESTUDIO_POST_MIGRACION.md`: arquitectura real, decisiones, regresión y límites de evidencia.

## Línea base antes de editar

| Comando | Resultado |
|---|---|
| `npm ci` | OK; 0 vulnerabilidades. npm mostró avisos de mantenimiento de ESLint y scripts de instalación no aprobados. |
| `npm run lint` | OK |
| `npm run lint:ignore-growth` | FALLA preexistente: `HEAD^` no contiene `eslint.config.mjs` por ser un merge cuya primera rama precede a la migración. Corregido en fase 0 para elegir el padre más cercano con ese archivo. |
| `npm run typecheck` | OK |
| `npm test` | OK: 50 archivos, 288 pruebas |
| `npm run build` | OK; bundle inicial 499.77 kB (167.99 kB gzip), chunk `legacy-sync` 540.29 kB (128.95 kB gzip); aviso existente por chunk mayor a 500 kB. |
| `node scripts/validate_cards.mjs` | OK: 36 temas |
| `npm run test:e2e` | OK: 80 pruebas Chromium y WebKit; 17 rutas, modos claro/oscuro, invitado, SW/CSP/offline. |

Las capturas y E2E son emulación Playwright. No acreditan una prueba física de Safari/iPadOS, sincronización real entre dispositivos ni revisión editorial humana.

## Fase 1 — Historial por intento

- El historial detallado vive separado de `tai.v1` en IndexedDB y se particiona por ámbito (cuenta o invitado). El formato de progreso agregado, copias existentes y las claves anteriores no cambian.
- Cada intento guarda su pregunta y revisión, modalidad, sesión, posición/exposición, estado terminal, respuesta, señales explícitas y eventos idempotentes. Las transiciones de dominio no realizan IO.
- El motor legado conserva su puntuación y selección. El seguimiento es opcional y se adjunta solo a sesiones nuevas; las sesiones antiguas siguen reanudándose sin eventos retroactivos inventados.
- El tiempo activo usa marcas monotónicas durante una ejecución y los intervalos visibles/pausados; tras interrupción la calidad se considera parcial cuando no se puede probar el intervalo final.
- El respaldo de ajustes conserva el objeto anterior e incorpora el bloque opcional `attemptHistory` versionado. La importación fusiona por IDs estables y el progreso antiguo se sigue importando con el mapper anterior.
- La sincronización Firebase es por UID y con listeners cancelables. Eventos terminales se escriben antes que su proyección; para conflictos `answered`/`revealed` gana determinísticamente el menor ID de evento y se conserva evidencia de ambos eventos. Una cola por intento evita carreras entre creación, evento y proyección.
- El borrado del historial detallado usa tombstone por ámbito; no borra progreso agregado. Las páginas locales usan cursor opaco y las lecturas de eventos remotos se limitan a la página del intento.
- Medición sintética reproducible: `npm run measure:attempts` genera 10.000 intentos, 30.000 eventos y 500 sesiones (20 intentos por sesión): 9.541.952 bytes JSON y 514.285 bytes gzip. Es una estimación de formato, no un tamaño observado de cuentas reales.

### Verificación de fase 1

Vitest cubre transiciones, eventos duplicados/conflictivos, mapper ida/vuelta, persistencia IndexedDB, importación/exportación y sincronización Firebase con mocks. Playwright cubre la creación y recuperación local en Chromium/WebKit. `npm run typecheck`, `npm run lint`, `npm run lint:ignore-growth`, `npm test`, `npm run build`, `node scripts/validate_cards.mjs` y `npm run test:e2e` pasan después del cierre de esta fase.

No se ejecutó el emulador de Firestore Rules: el entorno no tiene Java Runtime. Por tanto, las reglas nuevas se revisaron en código pero no se afirma que estén probadas contra el emulador ni contra Firebase real. Tampoco se hizo sincronización entre dispositivos ni una prueba física de Safari/iPadOS.

## Fase 2A — Ayuda y motivos de fallo

- Se añadió `#/ayuda`, disponible para invitados y con contenido local; la ruta no precarga el banco y se comprobó sin conexión desde el menú.
- El contenido cubre sesión, simulacro, puntuación/blancos, guardado/sincronización y repasos. La clasificación de motivo explica significado, ejemplo y cuándo elegir otra categoría.
- Los seis nombres y códigos históricos (`Contenido`, `Trampa`, `Dudaba entre dos`, `Despiste`, `No lo sabía`, `Velocidad`) permanecen iguales. La guía aclara que velocidad observada no determina por sí sola el motivo. No se deducen motivos automáticamente.
- Se añadieron accesos contextuales en la respuesta de práctica, controles del test, simulacros, falladas, tarjetas, estadísticas de fallos, puntuación y copias de seguridad.
- Cobertura automática: prueba unitaria que compara etiquetas contra el catálogo histórico y E2E en Chromium/WebKit para menú de invitado y disponibilidad sin conexión. La calidad editorial del texto y lectores de pantalla físicos requieren revisión humana.
- Las referencias visuales de 24 capturas se actualizaron intencionalmente para reflejar esos enlaces visibles en resultado, test, simulacro, exámenes, tarjetas y falladas, en ambos temas y motores. No se cambiaron las aserciones funcionales ni los límites de comparación.

## Fase 2B — Navegación y consulta voluntaria

- En práctica, el mapa muestra sin visitar, pendiente, respondida y solución consultada. Se puede retroceder/avanzar; las respuestas ya contestadas quedan deshabilitadas y el motor también rechaza una segunda respuesta.
- «No lo sé» ahora deja la pregunta pendiente, registra el evento, no añade una respuesta al progreso y avanza a la siguiente. Al volver se puede contestar. No se muestra clave ni feedback al marcarla pendiente.
- «Ver solución» solo aparece para una pregunta pendiente. Antes del control se informa que verla impide responder en ese intento. La consulta persiste en `tai.run:<ámbito>` y en el historial por intento, no se puntúa como acierto/fallo y en el resultado se cuenta como blanco con un contador separado.
- Sesiones antiguas sin `studyStates` siguen siendo compatibles. Una respuesta histórica `-1` se interpreta como solución consultada porque la interfaz anterior mostraba la respuesta al pulsar «No lo sé»; no se reescribe el progreso histórico ni se fabrican eventos retroactivos.
- El simulacro mantiene su mapa, navegación, edición de respuesta y ausencia de soluciones antes del cierre. El cambio de estado y los controles de práctica no se aplican a su flujo.
- Pruebas: integración del motor con IndexedDB para pendiente/respuesta/consulta, importación de guardados antiguos, aserciones de progreso y Playwright en Chromium/WebKit que recarga, reanuda, navega y finaliza. Cuatro capturas de la ruta quiz (ambos temas y motores) reflejan el mapa y controles de práctica nuevos; verificaciones funcionales conservan sus asserts.

## Fase 3 — Marcas y señales de razonamiento

- La pregunta y cada opción admiten selección de texto en una raíz enfocada; `Mayús` + flechas permite extender la selección con teclado. Los controles aparecen al seleccionar texto. El estilo conserva contraste por categoría además del color: «Clave» usa amarillo y «Duda» azul. Se puede quitar una marca seleccionada.
- La ancla almacena campo, offsets, texto exacto y hasta 32 caracteres de contexto a cada lado, sin HTML ejecutable. Los `<br>` se representan como `\n` para calcular offsets, manteniendo el código en línea y el formato del DOM al pintar. Se calcula una revisión determinista de enunciado y opciones; si el texto aún coincide se conserva el offset, si se movió se acepta solo una coincidencia única con contexto y si no se puede justificar el movimiento se muestra como desactualizada.
- El motor registra señales opcionales en el intento actual; `tai.run:<ámbito>` conserva marcas, confianza y opciones descartadas al reanudar, y el historial IndexedDB registra sus eventos. Las sesiones nuevas empiezan sin marcas. El resultado conserva una copia de las señales de esa sesión y las presenta en su revisión, sin transferirlas a preguntas de otros intentos.
- La confianza («Seguro», «Entre dos», «Adivino») se bloquea tras responder/revelar. Descartar/restaurar no cambia la puntuación; las opciones se pueden seguir modificando en simulacro como antes. Las acciones se registran explícitamente y el simulacro no ofrece soluciones ni recomendaciones en directo.
- La ayuda local `#/ayuda?tema=marcas` explica ratón, teclado, selección táctil, confianza y descarte. E2E usa Playwright Chromium y WebKit para seleccionar con teclado en enunciado y opción, comprueba que seleccionar no contesta, persiste al recargar y reanudar, y revisa la marca postrespuesta en el resultado. Vitest cubre anclas entre nodos de texto/código, `<br>`, solapamiento de marcas, offsets, reanclaje inequívoco y contenido ambiguo.
- Las validaciones automatizadas de fase 3 pasan: typecheck, ESLint y control de crecimiento, 352 pruebas Vitest, build Vite, validador de 36 temas y 86 pruebas E2E Chromium/WebKit. El E2E del service worker descarga el banco, pasa a offline, inicia una sesión y guarda una marca local. La simulación de WebKit no sustituye una selección física con VoiceOver, lápiz o pantalla táctil en Safari/iPadOS; esa comprobación queda pendiente. Tampoco se ensayó sincronización real entre dispositivos.

## Fase 4 — Explicaciones de código versionadas

- Se añadió un índice externo `public/explanations/index.json`, un DTO explícito, un mapper validado, una entidad de dominio y el puerto/adaptador HTTP con caché por sesión de página. La explicación se asocia al identificador y a una huella del enunciado y las opciones; si no coincide la versión, se informa que está obsoleta y no se presenta.
- En práctica se consulta solo tras responder o tras usar «Ver solución». En un simulacro no aparece feedback ni explicación mientras está activo; el resultado final puede mostrarlas. Si la sesión se abandona como interrumpida, tampoco se cargan explicaciones en ese resumen. La ausencia de explicación mantiene el flujo normal y el índice forma parte de la descarga offline y del shell generado.
- El render escapa texto, fragmento, salida, notas y fuentes; el código solo se muestra y nunca se ejecuta. Los enlaces externos requieren HTTPS y usan `noopener noreferrer`. Se añadió ayuda sobre el estado editorial y el momento en que aparecen.
- El piloto contiene cinco registros, todos marcados `draft` y con aviso de revisión humana pendiente. No se realizó revisión editorial humana ni ejecución de los ejemplos; las fuentes normativas se enlazan a la JLS. La heurística del banco halló 177 candidatos posibles, cifra orientativa y no cobertura confirmada. AT303-P1-09 y AT303-P1-13 quedan en cola editorial por dudas de gramática/intención y de identificador, respectivamente. Detalle en [REVISION_EXPLICACIONES.md](REVISION_EXPLICACIONES.md).
- Pruebas añadidas para mapper/ida y vuelta, URL insegura, XSS, contenido ausente/desactualizado, revisión del banco real, uso en práctica, persistencia al reanudar, simulacro sin feedback en curso e índice offline. `npm test`: 69 archivos, 362 pruebas; `typecheck`, `lint`, `lint:ignore-growth`, `build` y `validate_cards` pasan. Build genera dos chunks de 548 KB y 553 KB minificados (131 KB y 185 KB gzip); Vite conserva el aviso de chunk mayor de 500 KB. `npm run test:e2e:ci`: 86 escenarios de referencia y 90 de la rama actual en Chromium/WebKit, verdes en la última ejecución.
- La referencia visual E2E ahora apunta al commit final de la fase 3 (`06aebad67821714e4c044f4c53ce2a370010afa8`), ya que el SHA anterior predecía pantallas previas a los controles de práctica actuales. Se conserva la tolerancia de solo 0,1 % para pequeñas diferencias de rasterizado. Esto no relaja aserciones de comportamiento.
- La prueba E2E automatizada se ejecutó con Chromium y WebKit de Playwright en este host. No equivale a Safari/iOS físico, pruebas con lector de pantalla ni a validación en Firebase real; tampoco sustituye la revisión editorial humana indicada arriba.

## Fase 5 — Analítica de estrategia de examen

- Se añadió el cálculo puro `analyzeAttemptStrategy` y el caso de uso `getStrategyReport`. El informe toma el historial detallado local del ámbito actual y metadatos de banco actuales; solo incluye sesiones completadas del periodo. Sesiones activas/interrumpidas se cuentan aparte y no entran en métricas finales. Las sesiones antiguas sin eventos no reciben reconstrucciones históricas.
- El informe desglosa modalidad, primera exposición/repetición, tema, origen, tipo, revisión del contenido y dificultad explícita. Cuenta aciertos, fallos, pendientes, consultas, preguntas sin visitar, cambios de respuesta únicamente en simulacro, confianza declarada, opciones descartadas y marcas anteriores/posteriores. Un dato ausente se presenta como no disponible, no como cero medido. El tiempo usa intervalos completos para percentiles y presenta aparte tiempos parciales/no disponibles.
- La expectativa usa los parámetros de puntuación entregados al cálculo (`1` por acierto, `1/3` de penalización y `0` por blanco en esta integración). Solo se genera una orientación de simulacro con al menos 20 respuestas evaluables en tres sesiones. Es una tasa promedio del segmento, no una probabilidad por pregunta ni causalidad. El informe muestra fórmula/denominadores y propone una comparación manual en tres sesiones futuras comparables; se puede ignorar una pregunta cuya dificultad o revisión no coincida con el segmento.
- La sugerencia de segunda vuelta requiere al menos 20 intervalos temporales completos y tres simulacros con límite de tiempo y blancos. Compara el p75 de duración observada con la mediana de segundos restantes por blanco; no prescribe un límite a partir de una media individual. Su experimento sugerido es contrastar finalización y puntuación entre sesiones comparables.
- En el resultado de un simulacro completado se puede cargar el mismo informe; un simulacro activo no revela correcciones ni explicaciones. La pestaña «Evolución» de estadísticas incluye selector de 30, 90 o 365 días. El informe se calcula manualmente y no se envían datos a servicios externos.
- Una nueva prueba de IndexedDB encontró que los cursores de intentos y eventos usaban solo un límite inferior. La paginación podía cruzar el ámbito de otra cuenta y cada intento podía escanear eventos ajenos. Se acotaron ambos rangos por su clave compuesta y se añadió regresión con dos ámbitos y dos intentos. La comprobación E2E confirmó que el informe termina después de completar un simulacro de 40 preguntas.
- Pruebas de la fase: 372 tests Vitest, typecheck, lint, control de crecimiento, build y validador de tarjetas (36 temas) pasan. `npm run test:e2e:ci`: 86 escenarios de referencia y 90 de la rama actual pasan en Chromium/WebKit. La prueba de teclado enfocaba un `div` interno no enfocable dentro del botón opción; se adaptó a enfocar el botón real y el motor ahora trata sus flechas como selección de texto, acorde al texto de ayuda. Se conserva la activación nativa del botón con Enter/Espacio.
- Tamaño Vite antes (commit de fase 4): 1.102 KB minificados en chunks JS; 316,31 KB gzip. Después de fase 5: 1.117 KB minificados; 321,48 KB gzip, +5,17 KB gzip. El HTML aporta otros 0,44 KB gzip en ambos casos. El aviso de chunk mayor de 500 KB sigue presente.
- Límites: no hay datos sincronizados de Firebase real ni sesiones históricas sin eventos para medir; no se valida utilidad estadística con datos de usuarios ni se afirma causalidad. Playwright Chromium/WebKit no reemplaza Safari/iOS físico. El coste actual del bundle se registra en la verificación de esta fase.

## Fase 6 — Exportación manual para IA y borrado del historial detallado

- Ajustes permite filtrar por periodo, práctica/simulacro y sesiones completadas. Antes de descargar muestra sesiones, intentos, partes y tamaño; las descargas son botones manuales separados para manifiesto JSON, informe Markdown y cada parte JSON versionada. No hay envío automático ni conexión con servicios de IA.
- Cada parte agrupa sesiones completas y mantiene referencias internas anonimizadas entre sesión, intento, evento y subrayado. El manifiesto no incluye los IDs originales de sesiones ni de intentos, correo, UID ni configuración Firebase. El contenido de pregunta solo se incorpora si coincide exactamente con la revisión registrada; si no, queda fuera y se declara el motivo. Solo se añaden explicaciones con revisión editorial aprobada y revisión vigente.
- Se incluyen respuestas, clave correcta, modalidades, estados de blanco/consulta, confianza, descartes, subrayados y tiempos con su calidad. La exportación puede contener soluciones de examen. El Markdown separa medidas de hipótesis, muestra denominadores y puntuación y pide tratar preguntas/anotaciones como datos, sin inventar motivos o causalidad.
- El borrado conserva `tai.v1` y estadísticas agregadas. El adaptador local aplica un tombstone por ámbito, elimina intentos/eventos/sesiones anteriores al instante de borrado y conserva los registros posteriores. En cuentas sincronizadas primero registra el tombstone en Firestore y después borra páginas de eventos, intentos y sesiones; si la escritura o purga falla, el tombstone local reintenta la operación al volver a iniciar sincronización. Las reglas existentes ya autorizan que una persona borre sus documentos; no se modificó `firestore.rules`. Las copias que el usuario descargó antes quedan bajo su control.
- Se añaden pruebas de mapeo/versionado, Unicode y texto de código, referencias ausentes o de revisión distinta, anonimización, selección, división sin truncado, sesión individual sobredimensionada, borrado sin tocar agregados, purga remota, reintento tras una caída de red y cancelación al cambiar de cuenta durante una página. Ejemplo sintético generado por las funciones reales: [manifiesto](examples/ai-study-export-manifest-sintetico.json), [parte](examples/ai-study-export-parte-sintetica.json) e [informe](examples/ai-study-export-informe-sintetico.md).
- Verificación: typecheck, lint, control de exclusiones, 383 pruebas Vitest, build, validador de 36 temas y E2E con 86 escenarios de referencia y 92 de la rama en Chromium/WebKit pasan. Las capturas no necesitaron cambios. Bundle: 1.139,14 KB minificados y 328,42 KB gzip para los chunks JS (incluye el chunk de sincronización), +22,14 KB minificados y +6,94 KB gzip frente a fase 5. El HTML añade 0,44 KB gzip. Sigue el aviso de Vite por chunks mayores a 500 KB.
- La sincronización se verificó con mocks y Playwright local; no se ejecutó el emulador Firestore Rules ni una sincronización real entre dispositivos. No se realizó prueba física de Safari/iPadOS. La explicación del ejemplo es sintética y no representa contenido editorial revisado.

## Fase 7 — Integración, documentación y cierre

- Se añadieron dos recorridos completos en `tests/e2e/bridge.spec.ts`. El de práctica combina confianza, descarte, subrayado, «No lo sé», vuelta, respuesta, consulta de solución, bloqueo después de recargar, finalización y descarga manual de los intentos. Comprueba además que la pregunta respondida sí llega a `tai.v1`, las consultadas no aparecen como estadísticas y la exportación conserva los estados terminales.
- El recorrido de simulacro deja una pregunta en blanco, navega hacia atrás mediante el mapa y recarga. Verifica que no haya correcciones durante el simulacro, que se pueda modificar esa respuesta tras reanudar, y que las soluciones y el informe aparezcan únicamente después de completar la sesión.
- Las regresiones para fixtures antiguos, importación repetida, recuperación del espejo, ámbito de cuenta/invitado, rachas, calendarios y tarjetas se mantienen en Vitest (`legacy-fixtures`, `store`, `account-recovery`, `sync`, `regressions`, `spaced-repetition`, `flashcards`). No se reconstruye historial anterior a la instrumentación. Se documentaron el esquema versionado y los pasos de recuperación en `docs/ESQUEMA_HISTORIAL_INTENTOS.md`, el estado de capas en `docs/ARQUITECTURA.md` y el comportamiento visible en `README.md` y la ayuda integrada.
- Comprobación de navegadores: Chromium y WebKit son Playwright en macOS, no Safari ni iPadOS físicos. El historial de sincronización pasó por mocks y E2E local; no hubo Firebase real ni prueba entre dispositivos. El contenido de explicación que figura como borrador sigue pendiente de revisión editorial humana.
- Se verificó el texto máximo en viewports 320×720 y 1024×1366, tanto en Chromium como en WebKit emulados; no hubo desbordamiento horizontal. Esto no equivale a dispositivos físicos.
- Verificación de cierre: lint, control de exclusiones, typecheck, 383 pruebas Vitest, build y validador de tarjetas (36 temas) pasan. `npm run test:e2e:ci` pasa con 86 escenarios de referencia y 98 escenarios actuales en Chromium/WebKit; las capturas no cambiaron. El build conserva 1.139,14 KB de JavaScript minificado y 328,42 KB gzip, más 0,44 KB gzip de HTML. Sigue el aviso de Vite por chunks mayores de 500 KB.
- En la primera pasada, una prueba de recuperación local falló una vez en la suite completa y pasó aislada y en la repetición completa. También falló una vez un conteo DOM de subrayado en WebKit dentro del checkout de referencia; el mismo caso pasó aislado y la siguiente corrida de referencia completa pasó (86/86). Una corrida E2E actual detectó dos aserciones nuevas mal ubicadas; se corrigieron y la puerta completa se volvió a ejecutar. No se debilitó ninguna comprobación ni se regeneraron capturas en esta fase.
