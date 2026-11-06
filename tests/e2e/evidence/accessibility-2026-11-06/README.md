# Evidencia de accesibilidad — 6/11/2026

Lighthouse 13.4.1 snapshot mediante Chrome DevTools, preview local `http://localhost:5175/`, viewport observado 500×841 CSS px, tema claro, Firebase desconfigurado (`firebase-config.json` vacío). No son recorridos autenticados.

| Archivo | Estado | Accesibilidad | Fallos de accesibilidad |
| --- | --- | --- | --- |
| planning-before.json | Semana, antes | 99 | heading-order; label-content-name-mismatch |
| planning-after.json | Primer arreglo semántico | 100 | Ninguno detectado |
| planning-final.json | Arreglo final de etiquetas | 100 | Ninguno detectado |
| home-light.json | Inicio | 100 | Ninguno detectado |
| settings-light.json | Ajustes | 100 | Ninguno detectado |
| stats-empty-light.json | Estadísticas vacías | 100 | Ninguno detectado |

UX-021 incluye además etiquetas semanal/mensual comprobadas en regresión de componente con tema sintético. UX-022 tiene reproducción roja de regiones ambiguas y regresión verde de IDs únicos/H3. Suite focal 50/50, check global 966/27 omitidas, E2E Planificación 20/20 Chromium/WebKit.

No se afirma conformidad WCAG. Muchos criterios no aplican en estados vacíos; falta lector real, contraste completo y zoom nativo. Un intento de atajo de zoom no alteró viewport/escala y no cuenta como verificación. Se descartó una ejecución de Lighthouse sobre chrome-error cuando el servidor estaba detenido; no forma parte de estos informes. Los fallos SEO/Agentic Browsing no son fallos de la categoría accesibilidad.
