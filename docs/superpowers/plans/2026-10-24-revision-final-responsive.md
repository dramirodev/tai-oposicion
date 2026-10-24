# Revisión final de la aplicación publicada

Objetivo aprobado: recorrer todas las pantallas en móvil y tableta, reproducir fallos de diseño y corregirlos conservando código y progreso. Se mantiene la tecnología y la identidad actuales.

- [x] Comprobar versión publicada, estado Git y acceso disponible.
- [x] Registrar capturas y evidencia de Inicio, menú, Ajustes, Test, Simulacros (completo/examen/tema/supuesto), cuestionario, pausa, resultado, Falladas, Tarjetas, Temario, Progreso y entrenamientos Relámpago/Detective/Lectura; accesos y errores cuando proceda.
- [x] Revisar 390 y 1024 px, ampliar cobertura a 320/768 y letra grande/oscuro donde aparezcan riesgos.
- [x] Corregir hallazgos reproducibles; pruebas de regresión para comportamiento.
- [x] Verificar todas las correcciones y documentar límites de producción/invitado frente a local/acceso completo.
- [ ] Ejecutar pruebas, tipos, compilación y tarjetas; revisar diff; commit/push y despliegue ya autorizados en el chat.

Producción no tiene sesión iniciada en este navegador. No se simulará acceso a una cuenta real ni se alterará su progreso. Las pantallas restringidas se revisarán en localhost con el mismo checkout que el despliegue, dejando explícita esta limitación.

Resultado de la revisión: `docs/REVISION_FINAL_DESIGN_2026-10-24.md`. Verificación local: 221 pruebas, tipos, compilación y 36 temas con tarjetas correctos. Revisión independiente: 26 pruebas específicas correctas y sin regresiones adicionales tras atender sus dos observaciones.
