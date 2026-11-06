# CI42184320823: fallo de continuidad diaria

Fuente: https://github.com/dramirodev/tai-oposicion/actions/runs/42184320823
Head: 0ae64bf. Finalizó failure el 6/11/2026 a las08:27:36UTC.

Preparación, reglas, publicación atómica Emulator, check, build, QUICK y Astra/Auth: success. Referencia visual reconstruida; candidata305 passed,30 skipped,1 failed (16min). Único fallo: Chromium Linux, bridge.spec.ts:102, «la sesión diaria avanza dos actividades de test en viewport móvil». Timeout30000ms en línea123 esperando botón «Continuar actividad».

El código del fixture hace updatedAt:Date.now() antes de startedAt:Date.now(); el adaptador elimina registros si updatedAt < startedAt. Frontera reproducida con1ms en tests/adapters/training-session.test.js (10/10). Fix usa date.getTime() en ambas propiedades de los dos fixtures. No cambia producto ni timeout. ATE-014 conserva la distinción: defecto temporal reproducido, atribución exacta del run sin trace pendiente de confirmación remota.

Este run no subió test-results finales: el paso de artefactos incorporado en5a36d29 corrige esa carencia para futuras ejecuciones. El artefacto QUICK de este run sí corresponde a una ejecución exitosa real.
