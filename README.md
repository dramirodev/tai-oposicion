# Preparación TAI (PWA)

App web instalable para iPhone y iPad: test por tema, simulacro (parte 1 + supuesto), repaso espaciado de fallos
(+2, +5, +14, +30, +60 días) y estadísticas por tema/trampa. Funciona sin conexión y sincroniza el historial con Firebase.

Banco: 15.666 preguntas (oficiales, academia y generadas; cada una muestra su origen) + 417 de supuestos prácticos.

## Poner en marcha (una sola vez)

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
   firebase deploy
   ```
6. En el iPhone y en el iPad: Safari → abre **https://TU-PROYECTO.firebaseapp.com** (usa este dominio, no `.web.app`,
   para que el inicio de sesión con Google funcione dentro de la app instalada) → Compartir → **Añadir a pantalla de inicio**.
7. Abre la app desde el icono → Ajustes → **Entrar con Google** → **Descargar para uso sin conexión**.

## Cómo funciona la sincronización
- El progreso se guarda primero en el dispositivo (funciona sin red) y se sube a Firestore en segundo plano.
- Un documento por tema en `users/{uid}/stats/{tema}`; si dos dispositivos responden la misma pregunta, gana el más reciente.
- Las reglas solo dejan leer/escribir a cada usuario sus propios datos.

## Modos
- **Test por tema**: 10–40 preguntas, con corrección inmediata y la cita del temario en las generadas. Filtros: nuevas primero, aleatorio, falladas, dudosas; origen oficial/academia/generada.
- **Simulacro**: reparto por temas calcado a los exámenes oficiales, cronómetro con pausa, sin corrección hasta el final, nota = (aciertos − fallos/3) / total × 100. Parte 2 opcional: eliges 1 de 2 supuestos reales.
- **Repaso de fallos**: toda pregunta fallada entra en cola y reaparece a +2, +5, +14, +30 y +60 días.
- **Estadísticas**: acierto por tema, por tipo de trampa, por origen y últimas sesiones.

## Regenerar o modificar
- Datos: `python3 build_data.py` (lee los bancos de `BANCO_PREGUNTAS`).
- App: `npm install && npm run build` (el código está en `src/`, el resultado en `public/app.js` y `public/chunks/`; no se versionan: los genera el CI y, para desplegar a mano, `npm run build`).
- Avisos: las preguntas de **academia** llevan etiqueta propia porque sus respuestas no son oficiales y pueden contener errores; las oficiales de 2025 con plantilla provisional se marcan «Respuesta provisional».

## Cabeceras de seguridad (`firebase.json`)
CSP restrictiva en la página principal (solo scripts propios y `apis.google.com` para el login), `nosniff`, `Referrer-Policy`,
`Permissions-Policy`, HSTS y `Cross-Origin-Opener-Policy: same-origin-allow-popups` (necesaria para el login con ventana emergente).
Si algún día el login con Google o la sincronización dejan de funcionar tras un cambio, abre la consola del navegador y busca
mensajes «Refused to …»: indican qué dominio hay que añadir a la CSP.

## Pruebas
`npm install` y después `npm test` (Vitest, unos 5 s). Cubren:
- **Lógica pura** (`src/logic.js`): nota, reparto del simulacro, semáforo de dominio, utilidades.
- **Almacén** (`src/store.js`): repaso espaciado (+2, +5, +14, +30, +60 días), fusión con la nube y validación de datos externos (XSS, tipos).
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
- **Fase A (hecha):** al fallar una pregunta (motivo distinto de «Despiste») pulsa «📇 Hacer tarjeta». En Inicio → «Tarjetas de repaso»: primero ves la pregunta, pulsas para ver la respuesta y valoras *Fallé / Dudaba / Lo sabía* (teclas 1·2·3, deslizar ← / →). Mismos intervalos que las preguntas (2/5/14/30/60 días); fallar o dudar vuelve a +2 días. Las vencidas salen primero, mezcladas por tema.
- **Fase B (pendiente):** tarjetas curadas por tema en `public/cards/Txx.json` + `public/cards/index.json`; se validan con `node scripts/validate_cards.mjs` (también en `npm test`). Ver `docs/PLAN_FLASHCARDS.md`.
