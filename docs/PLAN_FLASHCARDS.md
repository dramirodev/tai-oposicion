# Tarjetas de repaso: estado y mantenimiento

Actualizado el 23 de octubre de 2026, versión 1.1.3. Este documento sustituye el plan inicial de
implementación: describe el código actual y conserva los criterios para mantener y ampliar el banco.

## Estado de las fases

| Fase original | Estado actual |
|---|---|
| A: tarjetas desde fallos | Implementada: creación, repaso, valoración, persistencia y eliminación local. |
| B: tarjetas curadas | Integradas: 1.410 tarjetas en 36 temas, índice, validador y muestra de revisión. La validación automática no acredita revisión humana completa. |
| C: sincronización y Anki | Implementadas en el código; su funcionamiento real entre dispositivos y la importación en Anki requieren comprobación manual. |
| C: estadísticas | Recuentos globales y resumen de sesión implementados. El desglose de tarjetas por tema y la carga de los próximos 14 días del plan original no están implementados. |

Comprobación local: 130 pruebas aprobadas en ocho archivos y compilación correcta. No consta en esta
revisión una comprobación del despliegue, de la instalación en iOS ni de la revisión humana de todas las tarjetas.

## Uso implementado

Entrada desde Inicio, ruta `#/cards`. Sesiones de 10, 20 o 30 tarjetas (20 por defecto), con hasta 10 nuevas.
Las vencidas salen primero, intercaladas por tema. Para las nuevas se puede elegir «Mis temas vistos»
(valor por defecto) o «Todos los temas»; sin temas vistos se incluyen todos.

La respuesta se revela con toque, Espacio o Intro. Después se valora con Fallé / Dudaba / Lo sabía
(1/2/3; también flechas o gestos izquierda/derecha para fallo/acierto). Fallé y Dudaba programan +2 días.
El primer acierto programa +2 días; los siguientes avanzan por 5/14/30/60 días y después la tarjeta queda dominada.
Una tarjeta creada desde un fallo vence el mismo día.

La pantalla inicial muestra vencidas, nuevas, en repaso y dominadas. El resumen final muestra los tres
niveles de valoración, porcentaje «Lo sabía» de la sesión y próxima fecha de repaso. No es una medida
exclusiva de retención de tarjetas ya repasadas: también puede incluir nuevas.
El reverso muestra referencia y nota cuando existen, permite avisar de errores y quitar tarjetas de fallo.
Las tarjetas con `revisar: true` se excluyen del repaso y de la exportación a Anki.

## Organización técnica

- `src/main.js`: arranque, navegación y motor de preguntas.
- `src/screens/cards.js`: carga de curadas y tarjetas de fallo, selección, interfaz de repaso y estado de la sesión.
- `src/screens/settings.js`: descarga offline y exportación a Anki.
- `src/data.js`: carga y caché de datos; `src/ui.js`: avisos, confirmaciones y apariencia compartidos.
- Las pantallas reciben navegación y gestión de limpieza desde el arranque, sin importar el archivo principal.
- `src/logic.js`: `pickCards(cards, recs, {n, now, maxNew, seen})`, `cardStats(cards, recs, now)` y `cardFromQuestion(q)`.
- `src/store.js`: `S.cards`, validación, `addFallo(qid, now)`, `gradeCard(id, grade, now)`, `removeCard(id)` y `mergeCards(m)`.
- Registro: `[n, ok, last, box, due, lastGrade]`. La fusión conserva el registro con `last` más reciente. `lastGrade = -1` identifica una marca de borrado, excluida del repaso.
- Persistencia: `localStorage` (`tai.v1`), copia IndexedDB y exportación/importación del progreso completo.
- `src/sync.js`: escucha y escritura del progreso en `users/{uid}/cfg/cards`, con `{m, u}`; no se usa la colección por tema propuesta en el plan inicial.
- `firestore.rules`: regla de `cfg/cards`, con uid propietario y correo autorizado verificado.
- `src/syncfacade.js` y `src/syncstate.js`: carga de Firebase bajo demanda y estado compartido.
- `public/cards/T*.json` y `index.json`: contenido curado; `public/cards/_muestra.md`: muestra para revisión.
- `public/sw.js`: caché de `cards/` junto con los datos. La descarga en Ajustes carga también las curadas.
- esbuild genera módulos ES con partición de código para Safari 15+: `public/app.js` y `public/chunks/`.

La eliminación de una tarjeta de fallo conserva una marca con fecha de borrado y la envía a la nube.
`getCards()` y `cardRec()` ocultan las eliminadas; `getCardsDoc()` incluye las marcas para sincronizarlas,
exportarlas y recuperarlas desde IndexedDB. Una copia anterior no debe restaurar la tarjeta; crearla de nuevo
produce un registro posterior. Actualizar todos los dispositivos para que reconozcan este protocolo de borrado.

## Formato del banco curado

Cada archivo de tema contiene un array, con hasta 40 tarjetas:

```json
{
  "id": "FC-T1.01-014",
  "t": "T1.01",
  "tipo": "cifra",
  "q": "¿Plazo de urgencia del Senado para vetar o enmendar un proyecto? (art. 90.3 CE)",
  "a": "20 días naturales",
  "ref": "Art. 90.3 CE",
  "src": "curada"
}
```

Tipos: `definicion`, `contraste`, `cifra`, `alcance`, `intrusa`. `caduca: true` indica un dato que puede
cambiar; `revisar: true` oculta una tarjeta pendiente de confirmar. Las de fallo usan `FC-Q-<idPregunta>`
y se reconstruyen desde el banco, sin duplicar todo el contenido en el progreso.

`public/cards/index.json` tiene la forma `{"temas":{"T1.01":39}}`, con el total de registros del archivo,
incluidas las tarjetas pendientes de revisión.

## Criterios editoriales

- Una tarjeta = un dato, con contexto suficiente para entender la pregunta por sí sola.
- Priorizar cifras, plazos, órganos, artículos, definiciones y diferencias difíciles de recordar.
- Respuestas de 1–25 palabras; preguntas de 15–300 caracteres; referencia obligatoria.
- No inventar fuentes ni confundir validación estructural con verificación del contenido.
- Favorecer contrastes e intrusas en legislación. El objetivo original del 30 % no lo impone el validador.
- Conservar ids estables: no renumerar tarjetas existentes; añadir nuevas con ids libres.
- Revisar una muestra de 10 tarjetas por tema y marcar las dudosas antes de utilizarlas.

El prompt de [PROMPT_GEMINI_FLASHCARDS.md](PROMPT_GEMINI_FLASHCARDS.md) sirve para ampliar o revisar
el banco existente, no para volver a generarlo entero sin preservar los ids.

## Validación y mantenimiento

```sh
node scripts/validate_cards.mjs
npm test
npm run build
```

El validador comprueba formato JSON, tema, ids únicos por archivo y formato de id, coincidencia del índice,
tipos, límites de longitud, referencia, origen curado, preguntas normalizadas sin duplicados por tema y
máximo de 40 tarjetas. Informa del número de tarjetas por tipo. Se ejecuta también dentro de `npm test`.

Para una comprobación textual auxiliar sin modificar el banco:

```sh
TEMARIO_DIR=/ruta/al/temario_txt python3 scripts/ground_cards.py --report
```

Este script busca coincidencias de palabras en el temario y en el banco de preguntas: es una heurística,
no una verificación semántica. Sin `--report` modifica los JSON y puede marcar `revisar: true`.
El temario original es externo al repositorio; la ruta predeterminada `/mnt/user-data/...` necesita adaptación.

Al cambiar contenidos, actualizar el índice y la muestra cuando corresponda, ejecutar las comprobaciones
y revisar la interfaz. Si se modifica el service worker, incrementar su versión `tai-vN`.
Los cambios de documentación por sí solos no requieren modificar el service worker.

## Exportación a Anki

Ajustes → Tarjetas descarga `tai-tarjetas-anki.txt`, UTF-8 con separador tabulador y cabeceras de importación.
Columnas: **pregunta, respuesta, referencia, etiquetas**. Las etiquetas contienen tema (punto sustituido
por guion bajo) y tipo. Se eliminan tabuladores y saltos de línea dentro de cada campo.
Incluye curadas disponibles y tarjetas de fallo; no exporta el historial ni las fechas de repetición de la PWA.

## Comprobaciones manuales pendientes de acreditar

- Revisar y confirmar el contenido de la muestra; ampliar la revisión cuando haya datos dudosos.
- Probar creación desde fallo, revelado, valoración, persistencia y uso sin conexión en iPhone/iPad/Mac.
- Comprobar login, sincronización entre dispositivos y reglas efectivamente publicadas.
- Importar el archivo en Anki y confirmar asignación de los tres campos y las etiquetas.
- Si se retoman los extras: diseñar estadísticas por tema y carga de 14 días; no aparecen como funciones terminadas.
