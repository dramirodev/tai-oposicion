# Plan de implementación: Flashcards en la PWA «Preparación TAI»

Documento para que **Gemini** (u otro agente) haga el trabajo pesado. Léelo entero antes de tocar nada.
Autor del encargo: David (opositor TAI/AGE, examen 1 jun 2027). Idioma de la app y de las tarjetas: español.

---

## 0. Qué hay que entregar (resumen)

1. **Fase A – Tarjetas desde fallos** (sin IA, solo código): botón «Convertir en tarjeta» al fallar y pantalla de repaso de tarjetas con repetición espaciada.
2. **Fase B – Tarjetas curadas por tema** (trabajo pesado de IA): ~15–40 tarjetas atómicas por tema generadas a partir del temario, en JSON validado.
3. **Fase C – Extras**: exportar a Anki (TSV), sincronización en la nube, estadísticas de tarjetas.

Orden recomendado: A → B → C. Cada fase se entrega con tests y sin romper los existentes.

---

## 1. Principios de diseño (extraídos del cuaderno de neurociencia de David)

Son requisitos, no sugerencias:

- **Una tarjeta = un dato.** Solo datos que no se deducen por lógica: fechas, plazos, cifras, números de artículo, definiciones literales, quién decide qué. Cada dato lleva su contexto breve (p. ej. «plazo de urgencia del Senado» y no «20 días» suelto).
- **No hacer tarjetas de todo el temario.** Lo deducible por narrativa o lógica interna NO va a tarjeta.
- **Recuperación activa:** primero se ve solo la pregunta; el usuario intenta recordar; después pulsa para ver la respuesta. Nunca mostrar la respuesta junto a la pregunta.
- **Respuesta corta:** 1–25 palabras. Sin párrafos.
- **Intervalos:** los mismos que ya usa la app para preguntas: `INTERVALS = [2, 5, 14, 30, 60]` días (`src/store.js`). Un fallo vuelve a la caja 0 (+2 días).
- **Intercalado:** las sesiones mezclan temas por defecto (no monográficas).
- **Autoevaluación con certeza** en 3 niveles: *Fallé* (0) · *Dudaba* (1) · *Lo sabía* (2). «Dudaba» cuenta como fallo para el calendario (vuelve a +2 días), igual que el botón «Acerté dudando» de los tests.
- **Retroalimentación inmediata** y referencia de origen (artículo / apartado del temario) en el reverso.
- **Errores:** el fallo por *despiste* no genera tarjeta. Tipos de fallo que sí: contenido y duda entre dos (→ tarjeta de **contraste**, A frente a B).
- **Esfuerzo deseable:** priorizar las tarjetas de contraste y de cifra exacta, que son donde el examen pone las trampas.

Tipos de tarjeta (campo `tipo`): `definicion`, `contraste`, `cifra`, `alcance`, `intrusa`, `fallo` (la generada desde un test).

---

## 2. Contexto técnico del proyecto (no lo reinventes)

- PWA en **JavaScript vanilla**, empaquetada con **esbuild** (IIFE, `--target=safari15`). Sin frameworks.
- Código en `PWA_TAI/`: `src/main.js` (pantallas y rutas hash), `src/store.js` (estado local, `localStorage` clave `tai.v1` + copia en IndexedDB), `src/sync.js` (Firebase/Firestore), `src/logic.js` (funciones **puras** con tests), `public/style.css`, `public/sw.js` (service worker; **subir la versión `tai-vN` en cada cambio**), `public/data/` (banco de preguntas).
- Tests: **Vitest** (`npm test`), 84 tests pasando al empezar. No se puede romper ninguno. Añadir tests para todo lo nuevo, sobre todo en `logic.js` y `store.js`.
- Build: `npm run build` genera `public/app.js`.
- Datos del banco: `public/data/index.json` (lista de temas `{id, nombre, n, …}`) y `public/data/T1.01.json`… (array de preguntas `{i, t, o, q, a[4], c, n, u, x, …}`). `n` es una nota explicativa y `u` la cita del temario cuando existen.
- Registro de preguntas: `[n, ok, last, box, due, lastRes, flag, segTotales, nCronometradas, motivo]` (10 campos; `cleanRec` en `store.js` valida todo lo que viene de fuera).
- Firestore (proyecto `tai-oposicion`): `users/{uid}/stats/{tema}` `{m:{id:[...]}, u}`, `users/{uid}/sessions/{id}`, `users/{uid}/cfg/seen`, `users/{uid}/cfg/reports`. Reglas en `firestore.rules` (`isOwner(uid)`: solo el correo del dueño, verificado). **Toda colección nueva necesita su regla.**
- Los ids con punto se codifican `.`→`~` en las claves de mapas de Firestore (`enc`/`dec` en `sync.js`).
- Seguridad: **nunca** insertar texto externo con `innerHTML` sin `esc()`; validar todo lo importado/sincronizado (patrón `clean*`).
- Interfaz existente que hay que respetar: tema claro/oscuro/auto (variables CSS `--bg --card --ink --mute --line --brand --accent --ok --bad --sel --selb`), tamaño de letra (`#app{zoom:var(--z)}`), teclado y gestos (`keyAction`, `swipeDir` en `logic.js`), barra de navegación inferior siempre visible con la sección resaltada (`sect` en `route()`).
- Lección operativa: copiar archivos al Mac y **verificar con md5** antes de dar algo por entregado.

---

## 3. FASE A – Tarjetas desde fallos (solo código)

### 3.1 Modelo de datos

Una tarjeta:
```json
{ "id": "FC-T1.01-014", "t": "T1.01", "tipo": "cifra",
  "q": "¿Plazo de urgencia del Senado para vetar o enmendar un proyecto? (art. 90.3 CE)",
  "a": "20 días naturales", "ref": "Art. 90.3 CE", "src": "curada|fallo" }
```
Tarjetas de fallo (`src:"fallo"`): `id = "FC-Q-" + idPregunta`; `q` = enunciado de la pregunta; `a` = texto de la opción correcta + nota `n` si existe; `ref` = `u` si existe. Se construyen en el cliente, no se guardan enteras: basta guardar el id de pregunta (se reconstruyen desde el banco).

### 3.2 Estado (en `store.js`)

- Nuevo mapa `S.cards = { [cardId]: [n, ok, last, box, due, lastGrade] }` (6 campos), con `cleanCard`/`cleanCards` y límites (p. ej. máx. 20 000 tarjetas, id con regex `^FC-[A-Za-z0-9._~-]{1,60}$`).
- Funciones: `cardRec(id)`, `gradeCard(id, tema, grade, now)` (grade 0/1/2; 0 y 1 → caja 0 y `due = now + 2d`; 2 → sube de caja, tras la última sale), `addFallo(idPregunta, tema)` (crea la tarjeta de fallo en caja 0, vence hoy), `removeCard`.
- Entrar en `exportAll/importAll/resetAll` y en la copia IndexedDB (`mirror`/`recover`).
- Tests: intervalos, «dudaba» = fallo, salida de la cola, validación de basura, persistencia.

### 3.3 Lógica pura (`logic.js`, con tests)

- `pickCards(cards, recs, seenTemas, {n, now})`: devuelve hasta `n` tarjetas: primero las vencidas (más atrasadas primero, **mezcladas por tema**, reutiliza el algoritmo de `pickRepaso`), luego nuevas de temas vistos (o de todos, ver ajuste), intercalando temas. Parámetro `scope: 'vistos'|'todos'`.
- `cardStats(recs)`: nº nuevas / en repaso / dominadas / vencen hoy.

### 3.4 Interfaz

- En el feedback de un test (cuando se falla, junto a «¿Por qué fallé?»): botón **«📇 Hacer tarjeta»** para los motivos *Contenido* y *Dudaba entre dos*. No se ofrece para *Despiste*.
- Nueva ruta `#/cards` (entrada en Inicio: «Tarjetas · N vencen hoy»; **no** añadir un 7º icono a la barra; que `sect` resalte «Inicio» o «Test» mientras se usa).
- Pantalla de sesión: tarjeta grande con el enunciado → toque o Espacio/Intro **revela** → tres botones *Fallé / Dudaba / Lo sabía* (teclas 1/2/3, gestos: izquierda = Fallé, derecha = Lo sabía, solo tras revelar). Contador, barra de progreso, salir con ✕. Debe verse bien en iPhone, iPad y Mac, en claro y oscuro, con los 4 tamaños de letra.
- Fin de sesión: resumen (n por nivel) y calendario de las próximas fechas.

### 3.5 Criterios de aceptación de la Fase A

- `npm test` verde, con tests nuevos para store y logic.
- Una pregunta fallada → «Hacer tarjeta» → aparece en `#/cards` el mismo día → al marcar «Lo sabía» vuelve a +2 días y desaparece de la cola hoy.
- Recargar la app o vaciar `localStorage` conserva las tarjetas (copia IndexedDB).
- Sin errores en consola; sin `innerHTML` sin `esc()`.

---

## 4. FASE B – Tarjetas curadas (el trabajo pesado)

### 4.1 Entradas

- Texto del temario por tema: `TEMARIO_OPOSICION/BANCO_PREGUNTAS/temario_txt/` (36 temas, ~5,8 MB). Nombres tipo `T1.01 Constitución Española - Temario.txt`.
- Banco de preguntas por tema (`public/data/Txx.json`) para detectar **qué se pregunta de verdad** (campos `x` = trampas, `d` = dificultad, `n` = nota) y no repetir.
- Lista de trampas y palabras trampa del proyecto (`PROMPTS/…/007_PALABRAS_TRAMPA.md`, si está disponible).

### 4.2 Procedimiento por tema (repetir para los 36)

1. Leer el temario del tema y el banco.
2. Extraer candidatos: cifras, plazos, mayorías, órganos competentes, números de artículo, definiciones literales, listas cerradas, diferencias entre conceptos parecidos.
3. Descartar lo deducible. Máximo **40 tarjetas por tema** (objetivo 15–30). Calidad sobre cantidad.
4. Redactar cada tarjeta con el esquema de §3.1 (`src:"curada"`).
5. Incluir al menos un 30 % de tarjetas `contraste` e `intrusa` en los temas legislativos (las que más se confunden en el examen).
6. Guardar en `public/cards/Txx.json` (array de tarjetas) y listar el tema en `public/cards/index.json` `{ "temas": {"T1.01": N, …} }`.

### 4.3 Reglas de redacción (obligatorias)

- `q` autosuficiente: debe entenderse sin ver la respuesta ni otras tarjetas. Incluir la norma o el contexto entre paréntesis.
- `a` ≤ 25 palabras. Si hay lista, máximo 5 elementos.
- Un solo hecho por tarjeta. Si hay dos cifras, son dos tarjetas.
- Prohibido inventar: cada dato debe estar en el temario. `ref` obligatorio (artículo, apartado o página).
- Para `contraste`: formato «A frente a B: …» con la diferencia exacta (p. ej. 3/5 frente a mayoría absoluta).
- Sin «todas las anteriores», sin opiniones, sin información que pueda caducar sin marcarlo (`"caduca": true`).
- Ids estables: `FC-<tema>-<nnn>` con numeración correlativa. **No renumerar** al regenerar; las tarjetas nuevas se añaden al final.

### 4.4 Prompt base para Gemini (por tema)

```
Eres un preparador de oposiciones TAI (AGE). Te paso el TEMARIO del tema {ID} y las PREGUNTAS del banco.
Genera tarjetas de memoria (flashcards) siguiendo estas reglas: una tarjeta = un dato; solo datos que no
se deducen por lógica (cifras, plazos, mayorías, órganos, artículos, definiciones literales, diferencias
entre conceptos parecidos); pregunta autosuficiente con su norma entre paréntesis; respuesta de máximo 25
palabras; campo "ref" con el artículo o apartado exacto del temario; mínimo 30 % de tarjetas de tipo
"contraste" o "intrusa" en temas legislativos; máximo 40 tarjetas. No inventes nada que no esté en el texto.
Devuelve SOLO un array JSON con objetos {"id","t","tipo","q","a","ref","src":"curada"} (y "caduca":true si
el dato puede cambiar). tipos válidos: definicion, contraste, cifra, alcance, intrusa.
TEMARIO: ...
PREGUNTAS: ...
```

### 4.5 Validación automática (crear `scripts/validate_cards.mjs` y llamarlo en `npm test`)

Debe comprobar, para cada `public/cards/Txx.json`:
- JSON válido; ids únicos y con el formato `FC-<tema>-<nnn>`; `t` coincide con el nombre del fichero y existe en `public/data/index.json`.
- `tipo` válido; `q` 15–300 caracteres; `a` ≤ 25 palabras; `ref` no vacío.
- No hay dos tarjetas con la misma `q` (comparando normalizado).
- Máx. 40 tarjetas por tema.
Y un informe por tema: nº de tarjetas, % por tipo.

### 4.6 Revisión humana (no saltarse)

- David revisará una **muestra de 10 tarjetas por tema** antes de darlas por buenas. Entregar un `public/cards/_muestra.md` con 10 tarjetas aleatorias por tema (q, a, ref) para revisarlas rápido.
- Cualquier dato dudoso se marca `"revisar": true` y no se muestra en la app hasta que David lo confirme (la app filtra `revisar:true`).
- Cada tarjeta tiene un botón **«Avisar de error»** que reutiliza el sistema de informes ya existente (`reports`, `MOTIVOS`) con `id` de tarjeta.

### 4.7 Integración en la app

- Cargar `public/cards/index.json` y, bajo demanda, `public/cards/Txx.json` (con caché del service worker; añadir `cards/` al precache offline que hace «Descargar para uso sin conexión» en Ajustes).
- `pickCards` mezcla curadas + de fallo. Ajuste en Ajustes o en la propia pantalla: alcance **«temas vistos» (por defecto)** o **«todos»**.
- Las tarjetas nuevas se introducen a ritmo limitado: máximo **10 nuevas por sesión** (configurable).

---

## 5. FASE C – Extras

1. **Sincronización en la nube**: documento por tema `users/{uid}/cards/{tema}` con `{ m: {cardId codificado: [...]}, u }`, igual que `stats`. Añadir regla en `firestore.rules` (mismo patrón: `isOwner`, `keys().hasAll(['m','u'])`, `m is map`). Fusión por `last` más reciente en `store.mergeRemote`-style (`mergeCards`). Pruebas de fusión.
2. **Exportar a Anki**: botón en Ajustes → fichero TSV con columnas `Pregunta[TAB]Respuesta[TAB]Bloque::Tema` (p. ej. `BloqueI::T1.01`), sin saltos de línea dentro de los campos, UTF-8. Convención de David: tipos definición/contraste/intrusa/cifra exacta/alcance.
3. **Estadísticas de tarjetas**: nuevas/en repaso/dominadas por tema y retención (% «Lo sabía» en repasos), y carga de los próximos 14 días (reutilizar `cargaRepasos` adaptando a tarjetas).

---

## 6. Archivos que se tocarán

| Archivo | Cambio |
|---|---|
| `src/logic.js` | `pickCards`, `cardStats`, helpers de tarjetas (puro, con tests) |
| `src/store.js` | `S.cards`, `cleanCard(s)`, `gradeCard`, `addFallo`, export/import/mirror |
| `src/sync.js` | Fase C: listener y `pushCards` |
| `src/main.js` | ruta `#/cards`, botón «Hacer tarjeta», entrada en Inicio, Ajustes (alcance, export Anki) |
| `public/style.css` | estilos de tarjeta, revelar, botones de nota; claro/oscuro |
| `public/sw.js` | subir versión `tai-vN` y precache de `cards/` |
| `public/cards/*.json` | Fase B |
| `firestore.rules` | Fase C: regla para `users/{uid}/cards/{tema}` |
| `tests/*.test.js`, `scripts/validate_cards.mjs` | nuevos tests y validador |
| `README.md` | documentar tarjetas |

---

## 7. Restricciones y trampas conocidas

- **No** romper la compatibilidad de datos: los registros de preguntas (10 campos) y los ya sincronizados deben seguir cargando. Todo dato nuevo pasa por `clean*`.
- **No** introducir frameworks ni dependencias de ejecución nuevas. Solo devDependencies si hace falta.
- Compatibilidad **Safari 15+** (iOS/iPadOS/macOS): sin sintaxis o API que no soporte (target esbuild `safari15`).
- Todo texto de tarjeta se escapa con `esc()` al pintarlo.
- Accesibilidad: botones ≥ 44 px, contraste suficiente en ambos temas, foco visible, funciona con teclado.
- Respetar el idioma: interfaz en español de España.
- Después de cada cambio: `npm test` → `npm run build` → prueba en navegador (Playwright o manual) → subir versión del SW.

---

## 8. Checklist de entrega

- [ ] `npm test` verde (incluye validador de tarjetas) y `npm run build` sin errores.
- [ ] Fase A probada: fallar → tarjeta → repaso → calendario.
- [ ] Fase B: 36 temas con tarjetas validadas + `_muestra.md` + marcadas `revisar` las dudosas.
- [ ] Fase C: sync con regla desplegada, export Anki abierto con éxito en Anki.
- [ ] `sw.js` con versión nueva; README actualizado.
- [ ] Despliegue (lo hace David): `npm install && npm test && firebase deploy --only firestore:rules,hosting`.

---

## 9. Decisiones pendientes de David (valores por defecto si no responde)

1. **Origen:** por defecto Fase A (tarjetas de fallos) primero y Fase B después.
2. **Alcance:** por defecto «solo temas vistos»; conmutable a «todos».
3. **Estilo de las respuestas:** por defecto corto (1–25 palabras); las listas solo cuando el temario las trate como lista cerrada.
