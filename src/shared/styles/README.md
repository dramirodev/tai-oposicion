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
