# Preparación TAI (PWA)

App web instalable para iPhone y iPad: test por tema, simulacro (parte 1 + supuesto), repaso espaciado de fallos
(+2, +5, +14, +30, +60 días) y estadísticas por tema/trampa. Funciona sin conexión y sincroniza el historial con Firebase.

Banco: 15.661 preguntas activas (oficiales, academia y generadas; cada una muestra su origen) + 417 de supuestos prácticos.

## Estado actual (29 de octubre de 2026)

Versión **1.1.12**. Banco de **36 temas**, **15.661 preguntas**, **417 preguntas de supuestos** y
**1.410 tarjetas curadas**. Las tarjetas marcadas `revisar: true` se excluyen del repaso y de la exportación.
Las comprobaciones locales más recientes están registradas en el handoff de desarrollo; una compilación o prueba local
no acredita por sí sola el último despliegue ni sustituye las pruebas reales de login, sincronización e instalación en iOS.

## Organización del proyecto

- `src/core/domain/`: modelos y reglas del estudio que no dependen de React, Firebase ni el navegador.
- `src/core/application/` y `src/core/ports/`: casos de uso y contratos que la aplicación necesita para leer contenido y progreso.
- `src/adapters/`: persistencia local, Firebase, banco HTTP y caché offline. Los adaptadores mantienen compatibilidad con los datos históricos mientras los consumidores usan modelos tipados.
- `src/features/`: pantallas, componentes, controladores y modelos de presentación agrupados por funcionalidad.
- `src/shared/`: UI, navegación y presentación reutilizadas.
- `src/app/`: React Router, composición de dependencias y arranque. Los módulos de composición conectan los puertos con los adaptadores concretos.
- `index.html`: entrada de Vite. `public/`: CSS, iconos, manifiesto PWA y service worker; `public/data/` y `public/cards/` contienen preguntas y tarjetas.
- `scripts/`: compilación, validación y comprobación de arquitectura y fuentes; `tools/`: utilidades auxiliares.
- `tests/`: Vitest, React Testing Library y Playwright.
- `.github/workflows/deploy.yml`: validación, compilación y publicación automática en Firebase.

## Desarrollo local

Usa **Node.js 24** (también indicado en `.nvmrc` y en el flujo de despliegue) y **Python 3** para el generador y sus pruebas:

```sh
npm ci
npm test
npm run build
```

La compilación con Vite 6 genera módulos ES para Safari 15+ en `dist/assets/`
y escribe `dist/version.json` y `dist/sw.js` con el SHELL de assets con hash. Estos archivos están excluidos de Git. Para probar la interfaz después de compilar:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory public
```

Abre [la aplicación local](http://127.0.0.1:4173). Para instalar la PWA fuera de localhost se necesita HTTPS.

## Configuración de Firebase (una sola vez)

1. **Proyecto de Firebase**: https://console.firebase.google.com → Añadir proyecto (plan Spark, gratis).
2. **App web**: Configuración del proyecto → Tus apps → `</>` Web → copia el objeto `firebaseConfig`
   dentro de `public/firebase-config.json` (sustituye los `PEGA_AQUI`).
3. **Authentication** → Método de acceso → activa **Google**.
4. **Firestore Database** → Crear base de datos (modo producción) → pestaña Reglas → pega `firestore.rules` y publica.
5. **Hosting** (en el Mac, desde esta carpeta):
   ```
   npm install -g firebase-tools
   firebase login
   firebase use --add        # elige tu proyecto
   npm ci
   npm test
   npm run build
   firebase deploy --only firestore:rules,hosting
   ```
6. En el iPhone y en el iPad: Safari → abre **https://TU-PROYECTO.firebaseapp.com** (usa este dominio, no `.web.app`,
   para que el inicio de sesión con Google funcione dentro de la app instalada) → Compartir → **Añadir a pantalla de inicio**.
7. Abre la app desde el icono → Ajustes → **Entrar con Google** → **Descargar para uso sin conexión**.

## Cómo funciona la sincronización
- El progreso se guarda primero en el dispositivo (funciona sin red) y se sube a Firestore en segundo plano.
- Un documento por tema en `users/{uid}/stats/{tema}`; si dos dispositivos responden la misma pregunta, gana el más reciente.
- También se sincronizan sesiones, temas vistos, informes de errores y progreso de tarjetas.
- Las tarjetas se guardan en `users/{uid}/cfg/cards` con `{m, u}`; al fusionar registros gana el de fecha `last` más reciente. Las eliminaciones conservan una marca sincronizada para que una copia antigua no las restaure.
- Las reglas actuales exigen el uid propietario y el correo de Google autorizado y verificado en `firestore.rules`.
  Para usar otra cuenta hay que adaptar y publicar esas reglas.

## Modos
- **Test por tema**: 10–40 preguntas, con corrección inmediata y la cita del temario en las generadas. Filtros: nuevas primero, aleatorio, falladas, dudosas; origen oficial/academia/generada.
- **Simulacro**: reparto por temas calcado a los exámenes oficiales, cronómetro con pausa, sin corrección hasta el final, nota = (aciertos − fallos/3) / total × 100. Parte 2 opcional: eliges 1 de 2 supuestos reales.
- **Falladas**: buscador con filtro por tema, respuesta correcta y fragmento del temario. Cada pregunta muestra un contador de aciertos seguidos (0/3) y una casilla «Repasada en el temario», que se puede marcar y desmarcar. La pregunta sale de Falladas al tercer acierto seguido; un nuevo fallo reinicia el contador y dejar en blanco lo conserva. La casilla no cuenta como acierto ni elimina la pregunta. Permite practicar hasta 40 resultados.
  Al marcar una pregunta repasada en el temario, TAI programa una comprobación de recuerdo dos días después. Si ya tiene otro vencimiento, mantiene ambos y selecciona el que llegue antes; un intento puntuado posterior al plazo completa esa comprobación. La marca no cuenta como acierto ni cambia la racha. Los registros antiguos aún pendientes empiezan en 0/3 porque no guardaban una racha reconstruible; no se inventan aciertos históricos. Contador y marca se guardan localmente, se incluyen en exportaciones y usan el registro de sincronización existente.
- **Repaso de fallos**: toda pregunta fallada entra en cola y reaparece a +2, +5, +14, +30 y +60 días.
- **Estadísticas**: acierto por tema, por tipo de trampa, por origen y últimas sesiones.

## Regenerar o modificar
- Datos: `python3 build_data.py --help` muestra las rutas configurables. Se necesitan los bancos originales externos al repositorio; no es necesario regenerarlos para compilar o abrir la app.
  Ejemplo desde cualquier carpeta (rutas de entrada de ejemplo, sustituir por las reales):
  ```sh
  python3 /Volumes/SSD/develop/PWA_TAI/build_data.py --bank-dir "/ruta/BANCO_PREGUNTAS" --supuestos-dir "/ruta/supuestos" --temario-dir "/ruta/temario_txt"
  ```
  `--bank-dir` debe contener `banco_literal.json`, `banco_academia.json` y `generadas/banco_generado_T*.json`;
  `--supuestos-dir` contiene `supuestos.json` y `supuestos_academia.json`; `--temario-dir` contiene los textos por tema.
  También se aceptan `BANK_DIR`, `SUPUESTOS_DIR`, `TEMARIO_DIR` y `OUT_DIR`; los argumentos tienen prioridad.
  Sin configuración, se busca `BANCO_PREGUNTAS` junto a la carpeta del proyecto, los supuestos dentro de ese banco
  y los textos en su subcarpeta `temario_txt`. La salida predeterminada es `public/data` junto al script, independientemente
  del directorio de trabajo; `--out-dir` permite probar en otra carpeta. Las entradas se leen y transforman antes de escribir.
- App: `npm install && npm run build` (el código está en `src/`, el resultado en `dist/`; no se versionan: los genera el CI y, para desplegar a mano, `npm run build`).
- Avisos: las preguntas de **academia** llevan etiqueta propia porque sus respuestas no son oficiales y pueden contener errores; las oficiales de 2025 con plantilla provisional se marcan «Respuesta provisional».

## Cabeceras de seguridad (`firebase.json`)
CSP restrictiva en la página principal (solo scripts propios y `apis.google.com` para el login), `nosniff`, `Referrer-Policy`,
`Permissions-Policy`, HSTS y `Cross-Origin-Opener-Policy: same-origin-allow-popups` (necesaria para el login con ventana emergente).
Si algún día el login con Google o la sincronización dejan de funcionar tras un cambio, abre la consola del navegador y busca
mensajes «Refused to …»: indican qué dominio hay que añadir a la CSP.

## Pruebas
`npm install` y después `npm test` (Vitest, unos 5 s). Cubren:
- **Reglas del estudio** (`src/core/domain/`): selección de preguntas, progreso, repetición espaciada y métricas, separadas de React y de la persistencia.
- **Sincronización y caché**: cancelación de escrituras al cerrar sesión, rechazo de listeners antiguos y recuperación de la configuración sin conexión.
- **Almacén legacy** (`src/adapters/local/legacy-store.ts`): importación segura, preferencias estructuradas, borrado sincronizado de tarjetas, repaso espaciado (+2, +5, +14, +30, +60 días), fusión con la nube y validación de datos externos (XSS, tipos).
- **Generador**: rutas externas, variables de entorno, salida y conservación del banco ante entradas ausentes.
- **Pantallas**: navegación por las rutas principales, cambio de tema y persistencia de una valoración de tarjeta al salir y volver.
- **Tarjetas**: selección, estadísticas, valoración, persistencia y fusión; `tests/cards.test.js` ejecuta además el validador del banco curado.
- **Banco** (`public/data`): ids únicos, 4 opciones, respuesta válida, citas de las generadas, coherencia con `meta.json` y supuestos elegibles.
Ejecútalas siempre antes de `firebase deploy`. Si cambias el banco, vuelve a correr `python3 build_data.py` y `npm test`.

## Evolución y preguntas lentas
- Cada respuesta guarda los segundos que tardaste (tope 120 s) en el registro de la pregunta (`[…, segTotales, nCronometradas]`).
- Cada sesión guarda aciertos por tema y por tipo de pregunta (hasta 300 sesiones, sincronizadas); los gráficos semanales salen de ahí.
- Los tipos solo existen en sesiones nuevas, y los tiempos solo desde esta versión.

## Sesión rápida
Botón «⚡ Sesión rápida · 5 min» en Inicio: unas 10 preguntas (según tu ritmo, entre 6 y 15) con hasta el 60 % de repasos vencidos y el resto nuevas, repartidas entre tus temas más débiles (de «Temas vistos» si los has marcado). Usa los orígenes de tu último test.

## Historial de simulacros, errores del banco y «mis trampas»
- **Datos → Simulacros**: gráfico de la nota por intento (parte 1), últimos intentos con la diferencia respecto al anterior y comparador de dos intentos por tema.
- **Avisar de error**: botón al contestar (con corrección) y en la revisión de resultados. Las preguntas marcadas van a *Ajustes → Errores del banco* (se sincronizan, se marcan como resueltas y se exportan a `errores-banco.json` con enunciado, opciones, respuesta y cita para corregirlas). Requiere publicar las reglas de Firestore (`firebase deploy --only firestore:rules,hosting`).
- **Mis trampas**: modo en *Test* que usa las 3 trampas con más fallos (≥5 respuestas por trampa), primero las falladas y luego las no vistas; en *Datos* cada trampa tiene un botón «practicar».

## Datos locales
El progreso se guarda en `localStorage` y se duplica en IndexedDB (también al pasar la app a segundo plano). Al arrancar se recupera lo que falte de la copia: en iOS, `localStorage` puede perder las últimas escrituras si se cierra la app enseguida.

## Tarjetas de repaso (flashcards)

Disponibles desde **Inicio → Tarjetas de repaso**. Se mezclan dos fuentes:

- **Curadas por tema:** 1.410 tarjetas en los 36 archivos `public/cards/T*.json`, con índice en `public/cards/index.json`.
- **Desde fallos:** al fallar una pregunta, «📇 Hacer tarjeta» permite incorporarla al repaso cuando el motivo no es «Despiste».
  Las tarjetas de fallo se reconstruyen desde la pregunta original y se pueden quitar durante el repaso.

Puedes elegir sesiones de **10, 20 o 30 tarjetas** (20 por defecto), con un máximo de **10 nuevas**.
Las vencidas tienen prioridad y se intercalan por tema. El alcance de las nuevas es «Mis temas vistos»
por defecto o «Todos los temas»; si no hay temas marcados, se usan todos.

Primero intenta recordar y después revela con un toque, Espacio o Intro. Valora con **Fallé / Dudaba / Lo sabía**
(teclas 1/2/3; tras revelar, deslizar a la izquierda equivale a Fallé y a la derecha a Lo sabía).
Los intervalos son **2, 5, 14, 30 y 60 días**; fallar o dudar vuelve a +2 días. La primera valoración
«Lo sabía» programa +2 días; los siguientes aciertos avanzan hasta dominar la tarjeta.

La pantalla muestra nuevas, vencidas, en repaso y dominadas. Al terminar ofrece recuentos por valoración,
porcentaje «Lo sabía» de la sesión y próxima fecha de repaso. El reverso muestra referencias y permite avisar de errores.

El progreso entra en la copia local, exportación/importación de `tai-progreso.json` y sincronización de Firebase.
En **Ajustes → Tarjetas → Exportar tarjetas a Anki (.txt)** se descarga `tai-tarjetas-anki.txt` en UTF-8,
con tabuladores y cuatro columnas: pregunta, respuesta, referencia y etiquetas de tema/tipo.
Incluye las curadas disponibles y los fallos convertidos en tarjeta; no exporta el calendario de repetición de la PWA.

Para mantener el banco: `node scripts/validate_cards.mjs` (también se ejecuta dentro de `npm test`).
La validación estructural no acredita la exactitud del contenido. Las tarjetas `revisar: true` permanecen ocultas
hasta su revisión editorial.

## Otros entrenamientos y ajustes implementados

- **Pregunta relámpago:** una pregunta, con prioridad a aciertos marcados como suerte, repasos y fallos.
- **Detective de trampas:** identificar las trampas de un enunciado, con o sin opciones visibles.
- **Lectura atenta:** entrenamiento guiado que prioriza fallos por velocidad y otros errores.
- **Ayudas de lectura:** modo normal, resaltar palabras clave o resaltar y frenar.
- **Simulacros:** indicador de ritmo durante la prueba y análisis final de tiempos, blancos y penalización.
- **Práctica guiada:** permite volver a preguntas pendientes; una respuesta queda bloqueada. «No lo sé» no revela la solución. «Ver solución» cuenta como blanco consultado y bloquea ese intento.
- **Señales de estudio:** se pueden marcar confianza y opciones descartadas y subrayar texto sin responder accidentalmente. Las explicaciones de código se muestran tras la corrección permitida, nunca durante un simulacro activo.
- **Historial y análisis:** desde que se activa el registro se conservan intentos y eventos por cuenta/dispositivo; las estadísticas antiguas no reciben eventos inventados. Ajustes permite exportar manualmente manifiesto, sesiones e informe para IA; no se envían datos automáticamente.
- **Personalización:** tema claro/oscuro/automático, cuatro tamaños de letra y fecha de examen para la cuenta atrás.
- **Uso sin conexión:** la descarga de Ajustes incluye preguntas, supuestos, metadatos y tarjetas curadas.

La exportación analítica es una copia separada, no sustituye `tai-progreso.json`. Para recuperar datos, no borres los datos del sitio: deja que la app restaure el respaldo local al abrirse; para importar una copia, usa Ajustes → Importar progreso. Las sesiones activas se ofrecen para reanudar al volver a abrir la app. El historial detallado se puede exportar/importar desde Ajustes junto con la copia compatible. Una copia importada se fusiona por identificadores y puede repetirse sin duplicar intentos.

## Versiones

- La versión es la de `package.json` y sigue semver. Para preparar el siguiente número, usa uno de estos comandos en una rama:
  - `npm run version:patch` para correcciones compatibles (por ejemplo, `1.1.3` → `1.1.4`).
  - `npm run version:minor` para añadir funcionalidad compatible (por ejemplo, `1.1.3` → `1.2.0`).
  - `npm run version:major` para cambios incompatibles que requieran adaptación (por ejemplo, `1.1.3` → `2.0.0`).
- Cada comando actualiza `package.json` y `package-lock.json`, pero no crea commits ni tags. Incluye ambos cambios en una PR a `main`; después de integrarla, el CI valida y publica la app y crea el tag de esa compilación.
- `npm run build` (`scripts/build.mjs`) inyecta la versión y el commit en la app y genera `dist/version.json` (no se versiona).
- En Ajustes → «Versión de la app» se ve la versión instalada. La app consulta `version.json` al abrirse y al volver a primer plano; si es distinta, avisa y el botón «Actualizar ahora» guarda lo que haya en curso y recarga.
- Si cambias el service worker, sube también su `V` en `public/sw.js`.

## Publicación

Cada push a `main` ejecuta pruebas, compilación y validación de tarjetas. Después despliega primero las reglas de Firestore y luego Hosting; si falla el despliegue de reglas, el flujo se detiene y no publica Hosting ni crea el tag de la release. La cuenta de servicio necesita el rol «Firebase Rules Admin».
Procedimiento y configuración en [DESPLIEGUE_AUTOMATICO.md](DESPLIEGUE_AUTOMATICO.md).

## Mantenimiento de seguridad y accesibilidad

- Los mapas importados rechazan claves reservadas y registros heredados; los ajustes se validan según los campos que admite cada pantalla.
- Los ajustes de apariencia y estudio se conservan en la copia local y en la exportación/importación del progreso.
- Al cerrar sesión o reiniciar la sincronización se cancelan las escrituras diferidas y los listeners anteriores.
- El service worker conserva la última configuración de Firebase obtenida correctamente para poder recuperarla sin conexión.
- La interfaz permite reflujo en pantallas estrechas, diálogos con desplazamiento y activación de botones con Enter/Espacio.
- Las herramientas de compilación y pruebas están actualizadas. `package.json` fija versiones corregidas de `undici` y `@grpc/grpc-js`
  mediante `overrides`, conservando la versión principal del SDK Firebase. Al actualizar ese SDK, revisar si estos overrides siguen siendo necesarios.
- Verificación del 23 de octubre de 2026: `npm audit` del árbol instalado sin vulnerabilidades conocidas. Esto no sustituye una revisión de producción.

Las cabeceras de `firebase.json` solo se aplican al desplegar en Firebase Hosting; el servidor HTTP local de desarrollo no las añade.
La sincronización real entre dispositivos y la prueba con VoiceOver/iOS siguen requiriendo comprobación manual.

## Comprobación de diseño adaptable en iPad

Revisión del 23 de octubre de 2026 en ventanas de navegador de 768×1024, 1024×768, 820×1180,
1180×820, 1024×1366 y 1366×1024 píxeles CSS, más una ventana estrecha de 507×768 para simular uso dividido.
Se comprobó también el tamaño máximo de letra (A+++, escala 1,5).

Inicio, configuración y sesiones de tarjetas, Test, Simulacros (completo, por examen y por tema), Estadísticas,
Ajustes y el menú se revisaron sin desbordamiento horizontal en los casos comprobados. La barra de acciones
compensa la escala de letra para quedar unida a la navegación inferior; las cabeceras adhesivas compensan
la misma escala en su posición respecto al área segura. El desplazamiento al revelar una tarjeta reserva espacio
para las barras y se reajusta al terminar el giro. El menú dispone de desplazamiento en horizontal.

Estas comprobaciones verifican el diseño en tamaños representativos; la instalación PWA, el teclado en pantalla
y las áreas seguras reales de Safari/iPadOS necesitan una prueba en el dispositivo.

## Revisión OCR

`python3 public/data/revision-ocr/audit.py --output /tmp/pwa-tai-audit` genera candidatos y una muestra reproducible de hasta 300 preguntas no marcadas (semilla 20183321). `--root` permite comparar otra copia del proyecto. No modifica el banco. Los avisos son heurísticos: requieren cotejo con el original antes de corregir respuestas o distractores. La carpeta `data/revision-ocr/` está excluida de Firebase Hosting; guarda los informes fuera de `public/`.

La auditoría local del 24 de octubre cubre búsqueda inmediata y navegación durante cargas de Falladas, validación OCR de opciones mal formadas, bancos pequeños y falsos positivos en preguntas tipo test sobre ENISA. La compilación y las pruebas automáticas no acreditan login, sincronización ni un iPad físico.

### Estado de la revisión editorial y de Falladas

Las 13 decisiones editoriales autorizadas se documentan como registro histórico en `public/data/revision-ocr/editorial-13.md`. El código posterior restauró cuatro de las reformulaciones y conserva sus advertencias. Las tres preguntas históricas están marcadas `np: 1`: se excluyen automáticamente de los simulacros puntuables y se conservan para estudiar con sus advertencias. La definitiva de ingreso libre para Tomcat sigue pendiente.

Por petición posterior se modifica Falladas: la extensión opcional de cada registro guarda la racha en la posición 10 (-1 sin fallo pendiente histórico; 0–3 tras fallo) y la marca de temario en la 11 (0/1). La fecha de modificación de la marca se guarda en la posición 12 y se fusiona independientemente de la respuesta, sin alterar el día de actividad. La validación, importación y fusión remota conservan estos campos; los registros antiguos siguen siendo legibles. Versiones antiguas de la aplicación que no conocen la extensión podrían descartarla si reescriben el progreso, por lo que conviene usar la misma versión en todos los dispositivos.

### Exclusión de preguntas históricas

`np: 1` excluye L2018S-S2-R-03, L2025A-S1-R-02 y P2018-S2-03 de sesiones sin corrección inmediata (simulacros puntuables). La selección de partes 1 y 2 filtra antes de completar el cupo; el motor aplica además el filtro al iniciar cualquier simulacro. Las sesiones puntuables antiguas guardadas que incluyan una excluida se descartan para no desalinear respuestas. Las sesiones de estudio conservan preguntas, opciones, claves y advertencias. No se cambia la marca de reserva para simular la exclusión.


### Correcciones tras la integración del banco remoto (24/10/2026)

El progreso, la copia de IndexedDB, la sesión pendiente y el acceso recordado se separan por UID. La copia antigua sin cuenta se conserva y solo se adopta al autenticar al propietario verificado. El invitado dispone de su propio progreso.
Los fallos de los supuestos también aparecen en Falladas y en el repaso, con el enunciado general y el contexto particular de cada pregunta. Importar una copia con sesión activa solicita subir el progreso y sus datos asociados.


### Aplicación React

La entrada de Vite es `index.html`; los datos fuente siguen en `public/data` y `public/cards`.
Firebase y el servidor local sirven `dist/`. `npm start` compila y sirve con la misma CSP global
que Firebase. `npm run deploy` conserva sus validaciones y su despliegue manual habitual.

`npm run test:e2e` ejecuta los recorridos Playwright configurados para Chromium y WebKit, usando el banco real,
Firebase sin configurar y almacenamiento aislado. Instala los navegadores requeridos con `npx playwright install chromium webkit`.
Las referencias visuales son específicas de plataforma y se actualizan mediante los scripts documentados en `tests/e2e/`.
No se autentica, no se escribe en Firestore ni se ejecuta un despliegue durante las pruebas.

Los recorridos E2E incluyen consulta de solución, persistencia al recargar, exportación manual y
simulacros con reanudación. Las pruebas de recuperación/importación antigua y las reglas de
repaso y tarjetas están en Vitest. La pantalla con texto máximo se comprueba en viewports emulados
320×720 y 1024×1366. Chromium y WebKit de Playwright son emulación: no prueban Safari físico,
iPadOS, sincronización real entre dispositivos ni revisión editorial humana.

## Modernización y límites de arquitectura

La migración conserva URL hash, datos guardados, funcionamiento offline y reglas
 de estudio. Cada pantalla o responsabilidad nueva debe reemplazar su versión
anterior, retirar sus consumidores y reducir las excepciones correspondientes.
No se consideran migraciones los cambios de nombre que mantienen el mismo puente.

- `core/domain` contiene reglas puras; `core/application` usa puertos. El core
  no importa DOM, adaptadores, React, Firebase, Zustand, idb ni Zod.
- `app` compone servicios. Las features reciben casos de uso por interfaces y
  no importan adaptadores ni la composición. Los DTO quedan en adaptadores.
- El estado de UI en memoria no sustituye la persistencia, el aislamiento de
  cuentas ni las reglas de sincronización. Los cambios deben ser explícitos.
- El código nuevo usa componentes React y eventos declarativos. El acceso DOM
  especializado necesita una responsabilidad acotada y limpieza al desmontar.
- `scripts/architecture-baseline.json` inventaría deuda existente, con ruta,
  responsabilidad y recuento. Se reduce al migrar; no se amplía para aceptar
  código nuevo. `npm run check:architecture` comprueba el grafo y escrituras HTML.

Antes de cada commit ejecutar `npm run check`. Al cerrar una fase ejecutar también
`npm run build`, `node scripts/validate_cards.mjs` y `npm run test:e2e:ci`.
Las PR ejecutan estas comprobaciones sin secretos ni despliegues. Las capturas
solo se cambian por cambios visuales revisados, nunca para ocultar regresiones.
