# Estilos compartidos

`index.css` es la única entrada, importada por `src/app/main.tsx`. Vite resuelve sus imports y publica una hoja minificada con hash en `dist/assets`. El generador del shell incluye todos los assets, también CSS; no añadir una URL fija `style.css` al service worker.

El CSS sigue siendo global porque las pantallas heredadas generan HTML fuera de la reconciliación React. Las clases e IDs usados por eventos son contratos: comprobar sus productores, consumidores y pruebas antes de renombrar.

## Responsabilidades y orden

1. `tokens.css`: colores semánticos, escalas, espacios y safe areas.
2. `base.css`: elementos, texto, foco y preferencias de movimiento.
3. `controls.css`: superficies, botones, diálogos, navegación y formularios.
4. `question.css`: preguntas, opciones, selección y corrección.
5. `progress.css`: resultados, mapa de dominio, gráficos e historial.
6. `cards.css`: tarjeta y respuesta de repaso.
7. `home.css`: inicio, tiles, menú, exámenes y código.
8. `motion.css`: efectos de respuesta y entrada.
9. `responsive.css`: reflujo, variantes de estudio y funcionalidades añadidas.
10. `workspace.css`: marco React de Precisión y presentación común de pantallas heredadas, aplicado al final mientras exista el puente.

Conservar este orden mientras existan variantes globales. No introducir una layer aislada: las reglas normales sin layer ganarían a esa layer. No purgar clases por búsqueda de literales; hay estados y nombres construidos dinámicamente.

## Contratos

- `data-theme` conserva la preferencia explícita. En automático no está presente. `legacy-ui.ts` resuelve la preferencia y los cambios del sistema en `data-color-scheme`; el oscuro se define una sola vez.
- `--mute` es texto secundario. `--good-ink`, `--bad-ink` y `--r-ink` son texto de resultado; `--ok` y `--bad` se reservan a indicadores, no a texto normal de tablas.
- Usar `--space-*` para separaciones repetidas y `--r-*` para radios. Los literales de geometría específica (marcadores, SVG, código) no necesitan un token propio.
- `.card-answer` solo representa respuesta de tarjeta; `.trap-false-alarm` y `.trap-detected` representan evaluación de trampas; `.evolution-hit` es la zona interactiva del gráfico.
- `layout-metrics.ts` observa navegación y barras fijas. Guarda alturas físicas en `--navigation-height` y `--actions-height`; el CSS compensa el zoom interno una sola vez. No introducir reservas por número de botones ni ocultar overflow del body.
- Los efectos de progreso usan transform, sin animar ancho ni sombras. El ancho final sigue representando el valor real. Respetar siempre la reducción de movimiento.

## Auditoría CSS-01 a CSS-12

| Hallazgo | Cambio |
|---|---|
| 01 | Opciones y descarte se apilan en móvil; texto ampliado tiene una fila completa |
| 02 | Mapa de dominio de una columna con letra grande; cabecera flexible y tarjetas reducibles |
| 03 | Referencias inválidas a `--muted` sustituidas por `--mute` |
| 04–05 | Tokens de texto para deltas y símbolos de corrección |
| 06 | Nombres independientes para tarjetas, trampas y zonas SVG |
| 07 | CTA, tiles, cabecera, selección de tema y reducción de movimiento consolidados |
| 08 | Alturas medidas, reserva dinámica y desplazamiento local si las acciones son muy altas |
| 09 | Tema oscuro único, énfasis semántico y escala de espacios reutilizable |
| 10 | CSS dentro del grafo de Vite y de la caché del shell |
| 11 | Progreso con transform y pulso sin sombra animada |
| 12 | Feedback hover limitado a punteros adecuados y controles habilitados |

`tests/e2e/css-ui.spec.ts` verifica reflujo, ancho de texto, descarte, contraste de símbolos, falsas alarmas, reserva de acciones y cambios del sistema. El test offline de `routes.spec.ts` comprueba que la URL CSS compilada esté en el shell y que se aplique tras recargar sin red. Validar además todos los recorridos y revisar los cambios intencionales de capturas antes de actualizar la referencia visual.

Las mediciones locales de gzip no son transferencia del hosting ni una prueba de velocidad. La validación en navegadores de escritorio tampoco certifica Safari iOS, dispositivos reales ni conformidad WCAG completa.

## Identidad y criterios del rediseño: A · Precisión

Dirección aprobada el 26 de octubre de 2026: marco neutro, acción principal en tinta y azul reservado a datos/foco. Fondo claro `#f5f6f7`, texto `#202326`; fondo oscuro carbón `#111113`, texto `#f1f1f2`. Los estados de acierto/error/pendiente mantienen su significado. No hay degradados ni sombras en paneles en reposo.

Geist variable se aloja en `fonts/geist-variable.woff2` con licencia SIL OFL en la misma carpeta. Vite publica la fuente con hash dentro de assets; el generador del shell la incluye automáticamente. No hay fuente externa ni nueva dependencia npm. El monospace queda reservado a código. Las cifras de métricas y tablas son tabulares.

`WorkspaceNavigation` es un componente React: sidebar desde 1100 px, menú móvil reutilizando el proveedor de diálogos y navegación rápida inferior en anchos menores. Inicio conserva su menú contextual. Los destinos siguen siendo las rutas actuales; Accesos depende del rol. La sidebar no usa el elemento nav para no interferir con el contrato de medición `nav[aria-label="Principal"]`. Al ocultarse la navegación inferior su altura medida es cero; la barra de acciones se centra en el espacio restante y compensa el zoom interno. El contenido de preguntas se limita a 860 px, el lienzo general a 1200 px.

Inicio prioriza continuar una sesión cuando existe, ofrece práctica rápida y repaso, agrupa las métricas reales en una franja y resume el dominio por los cuatro bloques del temario. No confunde temas estudiados con preguntas contestadas. Sus IDs y eventos se mantienen. Progreso presenta los temas en filas; Ajustes usa encabezados de sección a la izquierda y controles a la derecha cuando hay espacio. Opciones, tarjetas, diálogos, avisos, formularios y tablas comparten tokens.

`workspace.css` es una capa de presentación transitoria, sin CSS layers: las pantallas todavía generan HTML fuera de React. Mantiene las clases heredadas y concentra las variantes visuales de Precisión; no extraer ni renombrar esos contratos sin revisar los consumidores. Se han consolidado los tokens oscuros y eliminado la entrada animada de pantallas y el degradado obsoleto de la barra de acciones.

| Ancho | Intención |
|---|---|
| 380 px | Etiquetas de navegación compactas |
| 520/600 px | Opciones, filas y grupos se apilan |
| 840 px | Inicio permite práctica junto a repaso |
| 900 px | Ajustes en dos columnas cuando cabe |
| 1000 px | Supuesto lateral de la pregunta |
| 1100 px | Sidebar y navegación inferior oculta |

El texto ampliado conserva una columna para Inicio y mapa de dominio; no ocultar overflow global para disimular errores de reflujo. Los controles mantienen foco visible y objetivos táctiles de al menos 44 px cuando corresponde. Se conserva el enlace de salto, los avisos aria-live y las preferencias de movimiento reducido.

Verificar `typecheck`, `lint`, pruebas unitarias, build, validador de tarjetas y E2E Chromium/WebKit. Revisar cada cambio intencional de capturas antes de actualizar la referencia visual. La prueba offline verifica también que la fuente compilada esté en la caché del shell y disponible después de recargar sin red. Navegadores de escritorio no equivalen a dispositivos reales, lectores de pantalla ni certificación WCAG.
