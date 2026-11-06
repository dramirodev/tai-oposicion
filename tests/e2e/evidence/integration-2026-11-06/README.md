# Revisión de integración — 6/11/2026

Se inspeccionaron las 12 capturas actuales de Simulacros, parte 2 y Por examen, Chromium/WebKit, claro/oscuro; se compararon referencia y diferencia. Cambios esperados: pestañas Configurable/Oficial 2025 de main, foco de encabezado UX-018 y casos oficiales emparejados. Se conservan estilos, controles y ausencia de overflow; la prueba de navegación/flujo permanece activa.

Solo se reemplazan estas 12 referencias. `snapshot-review.json` registra huellas anterior/nueva; los PNG diff conservan evidencia. Reejecución posterior: 12/12 Chromium/WebKit; configuración/persistencia 2/2. El E2E inicial fue 292 aprobadas/30 omitidas/14 fallidas; las 14 fallidas pasan en estas repeticiones.

## Comprobación adicional de Simulacros

Preview offline integrado localhost:5176, Firebase config `{}`, tema claro, viewport 500×841. Lighthouse13.4.1 en Configurable y Oficial2025: accesibilidad100, sin fallos automatizados en esos estados. JSON versionados junto a este informe.

Comprobación interactiva real mediante Chrome DevTools: desde pestaña Oficial2025, tres Tab llevan al selector Baremo; `:focus-visible` verdadero, outline azul sólido3px. Shift+Tab y Enter activan Por tema y mantienen el foco en su pestaña; sin overflow horizontal. Los intentos de cambiar el select nativo con ArrowDown/Enter y Space/End/Enter no alteraron su valor en este canal de automatización; no se cuenta como comprobación de selección ni se atribuye a un fallo de producto. No se usó lector de pantalla real ni zoom nativo.
