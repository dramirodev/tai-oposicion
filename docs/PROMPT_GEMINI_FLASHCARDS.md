# Prompt para Gemini — tarjetas de un tema (repetir por cada tema)

El banco ya existe: 1.410 tarjetas en 36 temas a 23 de octubre de 2026. Usa este prompt para revisar
un tema o proponer ampliaciones; conserva los ids existentes y no sobrescribas el banco sin comparar los cambios.
Para revisar un tema existente, adjunta también su archivo `public/cards/{ID}.json` y pide conservar los ids
asociados a cada dato. Las tarjetas nuevas deben usar ids libres, con un máximo de 40 por tema.

Adjunta a Gemini DOS ficheros fuente y sustituye los valores entre llaves:
1. El temario del tema: `TEMARIO_OPOSICION/BANCO_PREGUNTAS/temario_txt/{ID} {NOMBRE} - Temario.txt`
2. El banco de preguntas del tema: `PWA_TAI/public/data/{ID}.json`

---------------------------------------------------------------- COPIAR DESDE AQUÍ

Actúa como preparador experto de la oposición a Técnico Auxiliar de Informática de la Administración General del Estado (TAI, AGE). Te adjunto el TEMARIO del tema {ID} ({NOMBRE}) y el BANCO DE PREGUNTAS de ese tema (JSON; en cada pregunta, "q" es el enunciado, "a" las 4 opciones, "c" el índice de la correcta, "n" la nota explicativa y "x" las trampas).

TU TAREA: crear tarjetas de memoria (flashcards) para repasar con repetición espaciada. Devuelve ÚNICAMENTE un array JSON válido, sin texto antes ni después, sin ```, sin comentarios.

FORMATO DE CADA TARJETA (todos los campos obligatorios salvo "caduca"):
{
  "id": "FC-{ID}-001",
  "t": "{ID}",
  "tipo": "definicion | contraste | cifra | alcance | intrusa",
  "q": "pregunta autosuficiente",
  "a": "respuesta corta",
  "ref": "artículo, apartado o página exacta del temario",
  "src": "curada",
  "caduca": true
}
("caduca": true solo si el dato puede cambiar con el tiempo, p. ej. versiones, plazos o normas en reforma; si no, omite el campo.)

PRINCIPIOS (obligatorios):
1. Una tarjeta = un solo dato. Si hay dos cifras, son dos tarjetas.
2. Solo datos que NO se deducen por lógica: cifras, plazos, mayorías, órganos competentes, números de artículo, definiciones literales, listas cerradas, siglas, versiones, y diferencias entre conceptos parecidos. NO hagas tarjetas de lo que se entiende por narrativa o sentido común.
3. La pregunta ("q") debe entenderse sola, sin ver la respuesta ni otras tarjetas: incluye entre paréntesis la norma o el contexto (p. ej. "(art. 90.3 CE)"). Prohibido "ese ejemplo", "lo anterior", "la tabla anterior".
4. La respuesta ("a") tiene como máximo 25 palabras. Si es una lista, máximo 5 elementos. Sin párrafos.
5. Nada inventado: cada dato debe figurar en el temario adjunto y "ref" debe indicar dónde (artículo, apartado o número de página). Si no encuentras la referencia exacta, NO incluyas la tarjeta.
6. Mínimo 30 % de tarjetas de tipo "contraste" o "intrusa" cuando el tema sea legislativo (Bloque I). En "contraste", la pregunta pide la diferencia exacta entre dos cosas parecidas y la respuesta empieza por "A frente a B:" o equivalente (p. ej. "3/5 del Congreso frente a mayoría absoluta"). En "intrusa", la pregunta pide cuál NO pertenece a una lista cerrada o cuál es el elemento que no encaja, indicando en la propia pregunta la lista completa.
7. Prioriza lo que el examen pregunta de verdad: fíjate en el banco adjunto (enunciados, trampas "x" y notas "n") para elegir qué datos merecen tarjeta, pero NO copies las preguntas del banco tal cual ni sus 4 opciones: reformúlalas como pregunta directa con respuesta corta.
8. Entre 15 y 30 tarjetas (máximo absoluto 40). Calidad antes que cantidad. Sin duplicados (ni la misma pregunta reformulada).
9. Español de España, estilo claro y sin adornos. Mantén siglas y nombres oficiales tal cual.

IDS: numeración correlativa de 3 cifras empezando en 001: FC-{ID}-001, FC-{ID}-002, … (sin saltos).

TIPOS:
- definicion: qué es / qué significa / en qué consiste algo (definición literal).
- cifra: un número, plazo, porcentaje, mayoría, año o versión exactos.
- alcance: quién, qué órgano o qué ámbito abarca / a quién se aplica / qué incluye o excluye.
- contraste: diferencia exacta entre dos conceptos o cifras que se confunden.
- intrusa: elemento que no pertenece a una lista cerrada.

EJEMPLOS (de otro tema, solo para ilustrar el estilo):
{"id":"FC-T1.01-001","t":"T1.01","tipo":"cifra","q":"¿Plazo de que dispone el Senado para vetar o enmendar un proyecto en el procedimiento de urgencia? (art. 90.3 CE)","a":"20 días naturales","ref":"Art. 90.3 CE","src":"curada"}
{"id":"FC-T1.01-002","t":"T1.01","tipo":"contraste","q":"¿Qué mayoría exige el Congreso para levantar el veto del Senado frente a la que exige para levantar una enmienda? (art. 90 CE)","a":"Veto: mayoría absoluta (o simple pasados 2 meses) frente a enmienda: mayoría simple.","ref":"Art. 90.2 y 90.3 CE","src":"curada"}

ANTES DE RESPONDER, COMPRUEBA TÚ MISMO CADA TARJETA:
- ¿El dato está literalmente en el temario y "ref" es correcta?
- ¿"q" se entiende sin contexto y "a" tiene ≤ 25 palabras?
- ¿Es un solo dato y no se deduce por lógica?
- ¿Los ids son correlativos, únicos y con el formato FC-{ID}-NNN?
- ¿El JSON es válido (comillas dobles, sin comas finales)?
Si alguna tarjeta falla alguna comprobación, corrígela o elimínala.

Responde SOLO con el array JSON.

---------------------------------------------------------------- COPIAR HASTA AQUÍ

## Después de recibir la respuesta

1. Compara el resultado con `public/cards/{ID}.json`; conserva ids estables y revisa las referencias antes de sustituir contenido.
2. Actualiza `public/cards/index.json` con el número total de tarjetas del archivo, incluidas las marcadas para revisión.
3. Revisa una muestra de 10 tarjetas por tema y actualiza `public/cards/_muestra.md` cuando corresponda.
   Marca las dudosas con `"revisar": true`: no se mostrarán ni se exportarán a Anki hasta confirmarlas.
4. Ejecuta `node scripts/validate_cards.mjs`, `npm test` y `npm run build`. El validador comprueba estructura, no exactitud factual.
5. Comprueba el repaso y la exportación en la app antes de publicar siguiendo [la guía de despliegue](../DESPLIEGUE_AUTOMATICO.md).

Detalles del estado actual y de las comprobaciones manuales en [PLAN_FLASHCARDS.md](PLAN_FLASHCARDS.md).
