# Diez correcciones tras la integración — 24/10/2026

Base: `d32f9ad`, que ya incorpora el banco opcional de Firestore. No se sustituyen `src/bank.ts`, el publicador, sus pruebas, las reglas ni los scripts nuevos del paquete.

| N.º | Problema | Corrección y comprobación |
| --- | --- | --- |
| 1 | El progreso de una cuenta podía subirse a otra. | Estado, almacenamiento local, copia de IndexedDB, acceso recordado y sesión pendiente separados por UID. Se conserva y restaura cada cuenta al volver; sesiones y tarjetas en pantalla se cancelan al cambiar. Las respuestas y reanudaciones antiguas se rechazan. Pruebas de cambio de cuenta, migración y restauración. |
| 2 | Cambiar entre dos cuentas aprobadas no iniciaba la sincronización nueva. | Se cancelan los listeners y temporizadores anteriores y se resuelve de nuevo el acceso. Las generaciones de sincronización y de acceso descartan callbacks obsoletos. Prueba de dos cuentas aprobadas y de callbacks antiguos. |
| 3 | «No lo sé» reiniciaba la racha de Falladas. | Se registra como blanco (2), sin tiempo cronometrado ni reinicio de racha. Se conserva la regla de tres aciertos seguidos. |
| 4 | Cuatro preguntas restauradas perdieron sus advertencias. | Se conservan identificadores, enunciados, opciones, citas y claves originales. Se añaden notas específicas y `np: 1`: disponibles para estudio y excluidas de sesiones puntuables. Véase el desglose siguiente. |
| 5 | Doble pulsación en Terminar duplicaba intentos y sesiones. | Cierre único en el motor y bloqueo del segundo cierre en la interfaz. Prueba del motor y prueba de doble pulsación en la pantalla real. |
| 6 | Los fallos de supuestos no aparecían en Falladas ni se recuperaban por identificador. | Índice de supuestos adicional, búsqueda por ID y tema, sincronización y repaso. Se conservan el texto general y los contextos particulares sin alterar el banco por temas. Pruebas de selección, contexto y salida al tercer acierto. |
| 7 | Una respuesta remota podía borrar la marca posterior de temario repasado. | La marca usa un reloj propio en la posición 12. Se fusionan por separado respuesta y marca; marcar o desmarcar no cambia la fecha de estudio. Se prueba también la publicación del registro fusionado y la compatibilidad con registros antiguos. |
| 8 | Importar con listeners ya activos no subía los datos nuevos. | La importación solicita publicar estadísticas, sesiones, temas vistos, informes y tarjetas si existe acceso. Sin conexión o sin acceso quedan locales para la sincronización posterior; al recibir las sesiones remotas también se publican las locales ausentes. Prueba de la escritura real enviada a la frontera de Firestore. |
| 9 | Un 503 del servidor impedía usar el shell guardado. | Una respuesta HTTP fallida activa la recuperación de caché para HTML, JS y CSS. Prueba ejecutando el service worker con red 503 y copia disponible. Se actualiza la versión de la caché del shell. |
| 10 | El calendario desplazaba repasos en días de 25 horas. | Se comparan fechas naturales locales, sin suponer que cada día dura 24 horas. Prueba con Europe/Madrid el 25/10/2026, a las 23:30, que debe contar como hoy. |

## Preguntas restauradas: advertencias y puntuación

Las evidencias del cotejo anterior siguen en `public/data/revision-ocr/editorial-13.json` y su informe Markdown. Esos archivos son registros históricos, no una descripción del estado actual del banco.

- **AT309-P1-12**: valoración ambigua de los criterios WCAG AAA; no hay una incorrecta inequívoca. Clave D histórica conservada sin certificarla.
- **GEN-T3.03-48** y **GEN-T3.03-48.v1**: contradicción del temario entre páginas 16 y 21 y generalización no universal sobre conversiones y tipado. Claves C y D conservadas; la cita original no se presenta como validación técnica.
- **GEN-T3.08-418.v1**: las cuatro etiquetas propuestas existen en HTML actual; el temario atribuye incorrectamente falta de soporte a `u`. Clave C conservada solo como referencia del material original.

Se añade `n` y `np` a esas cuatro preguntas. No se reescribe contenido ni se inventan distractores. Las tres exclusiones históricas anteriores siguen vigentes.

## Migración y compatibilidad

- Claves nuevas: `tai.v1:<uid>`, `tai.acc:<uid>`, `tai.run:<uid>`. El invitado utiliza el sufijo `guest`. IndexedDB usa `state:<uid>` o `state:guest`.
- La antigua clave `tai.v1` y el registro `state` de IndexedDB no se eliminan. Solo el propietario autenticado con correo verificado puede adoptarlos; una marca persistente permite completar la recuperación de IndexedDB si se interrumpe el arranque.
- Una sesión pendiente antigua sin UID no se reanuda automáticamente, porque no permite determinar su propietario.
- La marca de temario añade un campo opcional al registro. Se siguen leyendo los formatos anteriores. Conviene actualizar los dispositivos antes de seguir estudiando: una versión antigua no conoce este reloj independiente.

## Validación

Las diez reproducciones fallaron antes de aplicar las correcciones. La suite completa incluye regresiones de sincronización, almacenamiento, contexto de supuestos, calendario y doble pulsación en la interfaz DOM. También se ejecutan comprobación de tipos, compilación y validación de tarjetas.

Estas pruebas no sustituyen una comprobación de inicio de sesión con dos cuentas reales de Google ni una prueba en un iPad físico. El push a `main` activa el flujo automático de despliegue del repositorio.
