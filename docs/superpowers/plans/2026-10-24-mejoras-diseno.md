# Mejoras de diseño aprobadas — plan de ejecución

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or parallel agents with exclusive file ownership. Steps use checkbox syntax for tracking.

**Goal:** Aplicar todas las propuestas de la auditoría aprobada en el chat, empezando por sus cinco prioridades, preservando el progreso y el código del banco remoto.
**Architecture:** Se mantienen TypeScript, pantallas registradas y almacenamiento por cuenta. Utilidades pequeñas para estados accesibles, avisos y fuentes verificadas. Ninguna migración destructiva ni cambio de claves/respuestas del banco.
**Tech Stack:** TypeScript, DOM, CSS, Firebase, Vitest.
**Spec:** Auditoría de diseño del chat del 24/10/2026, aprobada expresamente con «Aplica todas las mejoras propuestas».

## Global Constraints

- Mantener identificadores, banco remoto y todo el progreso; tres aciertos seguidos, blanco neutro y marca de temario independiente.
- No publicar PDF locales ni inventar fuentes, páginas, fechas oficiales o datos de estudio.
- Conservar la identidad visual, lectura amplia, tema oscuro, teclado, foco y reducción de movimiento.
- Verificar estado Git antes de editar y antes de publicar; no sobrescribir cambios ajenos.
- Push autorizado por el usuario; main activa el despliegue automático.

## Review Focus

- Importación válida/corrupta y cambio de cuenta durante una operación: no mezclar ni perder datos.
- Filtros vacíos, cero temas vistos y resultados parciales: no sugerir una selección distinta de la efectiva.
- Letra grande y 390 px: títulos legibles, acciones accesibles y contexto de pregunta conservado.
- Simulacro con preguntas en blanco/revisión: respuestas e índices permanecen alineados y cierre único.
- Fuentes y descargas: solo enlaces seguros verificados; disponibilidad offline comprobada, no supuesta.

## Task 1: Cinco prioridades y utilidades comunes (principal)

Files: src/ui.ts, src/main.ts, src/engine.ts, src/types.ts, public/style.css; tests de regresión.
- [x] Añadir pruebas que fallen: estados accesibles, aviso antes de contestar, sesión interrumpida y conteo parcial sin cambiar nota oficial.
- [x] Reflujo de Inicio: dos columnas móviles y una con texto grande; centralizar estados aria de selectores.
- [x] Avisos visibles antes de responder; conservar clave histórica y exclusión puntuable.
- [x] Marcar cierre interrumpido sin cambiar esquema antiguo; mostrar respondidas, nota global y rendimiento contestado por separado.
- [x] Detective con opciones visibles al evaluar etiquetas dependientes de ellas (Task 2).
- [x] Ejecutar pruebas de módulo e integración.

## Task 2: Entrenamientos (agente exclusivo)

Files: src/screens/training.ts; tests/design-training.test.js.
- [x] Probar y corregir Detective: no evaluar etiquetas de opciones mientras se ocultan; instrucciones claras, controles con estado.
- [x] Lectura: una sola entrada de teclado al grupo de palabras, flechas/Home/End y espacio para seleccionar; alternativa explicada.
- [x] Avisos de calidad antes de responder en Relámpago y Lectura; mantener progreso, contextos y relojes existentes.
- [x] Cancelar ejercicios al cambiar de cuenta y comprobar que no se registran respuestas antiguas.
- [x] Ejecutar pruebas; entregar resumen y restricciones sin editar otros archivos.

## Task 3: Inicio, temas y estadísticas (agente exclusivo)

Files: src/screens/home.ts, src/screens/stats.ts; tests/design-home-stats.test.js.
- [x] Inicio: priorizar continuar/repasos/falladas, agrupar entrenamientos y mejorar primer uso/estado de acceso.
- [x] Fecha: no presentar 2027-06-01 predeterminada como oficial; configurar objetivo explícito.
- [x] Temas: búsqueda y bloques plegables; explicar preguntas vistas frente a temas estudiados; conservar selección y scroll/foco.
- [x] Estadísticas: resumen con acciones y secciones Temas/Simulacros/Evolución; no perder historial ni tabla accesible.
- [x] Leyenda con nombres visibles, estados accesibles y plurales correctos.
- [x] Ejecutar pruebas; entregar resumen sin editar CSS ni otros archivos compartidos.

## Task 4: Ajustes, disponibilidad offline y copias (agente exclusivo)

Files: src/screens/settings.ts; puede crear src/offline.ts y tests/design-settings.test.js.
- [x] Agrupar Cuenta/Lectura/Descargas/Copias; diagnóstico técnico plegable; estados de acceso y siguientes pasos claros.
- [x] Antes de importar: vista previa de añadidos/conservados y confirmación; después: resumen y estado de sincronización.
- [x] Proteger importación contra cambio de cuenta mientras se espera confirmación, sin sustituir el almacén.
- [x] Disponibilidad offline: comprobar caché real de recursos y mostrar faltantes, progreso y fecha solo tras verificación completa.
- [x] Mantener controles existentes y probar fallos de descarga/importación.
- [x] Ejecutar pruebas; entregar resumen sin tocar store/sync/config ni CSS.

## Task 5: Completar flujo de práctica (principal)

Files: src/main.ts, src/screens/cards.ts, src/config.ts si precisa validación aditiva; utilidades nuevas.
- [x] Falladas: marca fuera del desplegable, filtros de repasada y racha, actualización inmediata y práctica coherente con filtro.
- [x] Test: alcance explícito, búsqueda/bloques plegables y resumen junto al inicio.
- [x] Simulacros: oficiales primero y filtros origen/convocatoria/turno; mapa de respuestas/blancos/revisión, contexto lateral en tableta.
- [x] Tarjetas: número efectivo antes de empezar y próximo repaso por valoración; no alterar calendario.
- [x] Fuentes: abrir solo una URL verificable con página cuando exista; estado explícito cuando solo hay cita sin enlace.
- [x] Navegación «Progreso», microtextos y coherencia de iconos; mantener teclado/gestos.
- [x] Ejecutar pruebas de integración y preservación de datos.

## Task 6: Integración y publicación (principal)

- [x] Revisar cobertura de cada propuesta, cambios de los agentes y conflictos; revisión independiente final.
- [x] Ejecutar npm test, npm run typecheck, npm run build y node scripts/validate_cards.mjs.
- [x] Recorrer móvil/tableta, letra grande y oscuro; comprobar cinco prioridades y progreso tras navegar/recargar.
- [x] Documentar cambios y límites de validación real (VoiceOver/iPad físico).
- [ ] Revisar diff/status, commit, push y comprobar despliegue asociado.

## Decisiones de ejecución

La descripción completa ya fue aprobada en el chat; se ejecuta sin una nueva ronda de aprobación. Se reutiliza el checkout limpio actual de main y se divide por archivos exclusivos para preservar las integraciones. Las fuentes sin enlace verificable se identifican como cita disponible, sin fabricar enlaces a PDFs locales.

## Evidencia final

Cobertura y límites documentados en `docs/MEJORAS_DISENO_2026-10-24.md`. El filtro de años se etiqueta «Año en la referencia», ya que los nombres no prueban el año oficial de convocatoria. El recorrido visual cubre las resoluciones indicadas en ese documento; no representa una certificación en iPad físico o VoiceOver.
