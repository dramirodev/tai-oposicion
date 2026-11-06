# Perfiles longitudinales locales de Progreso

Fixtures version1: new=0 sesiones, partial=2, extensive=300 (límite existente del historial). Datos ficticios, guest local con acceso de desarrollo, Firebase config vacío; no son usuarios autenticados ni verifican sincronización remota.

Comando permanente: `npm run test:e2e -- tests/e2e/stats-study-profiles.spec.ts`.

Ejecución focal del6/11:6/6 Chromium/WebKit,320×900,14,3s. Para no interferir con la suite global concurrente se usó un config temporal en /tmp apuntando al mismo build estático en4189, sin rebuild; el spec se incluye automáticamente en la suite general. Verifica estado vacío,15 filas recientes como máximo,2/300 opciones de comparación, delta1/20 calculado desde extremos, igualdad exacta del historial antes/después de recargar y ausencia de overflow/errores JS. El seed solo se aplica si falta el progreso, no pisa escrituras al recargar.

Primera pasada2/6: faltaban fails/temas/tipos en los fixtures; el normalizador añadió correctamente esos campos. Se completó la forma canónica del fixture sin relajar la aserción de igualdad ni cambiar producto. Captura extensive WebKit inspeccionada: historial y comparación disponibles, sin clipping horizontal. Las capturas son evidencia de este fixture, no certificación de todos los perfiles/estados.
