# ATE-015: historial autenticado extenso

6 de noviembre de 2026. Solo app local4191, Auth9099 y Firestore8080, demo-tai-auth. Cuenta sintética tai-supertest@example.test; no Admin para verificar resultados ni Gemini.

## Reproducción anterior a la corrección

Supertest34749:12 aprobadas/1 fallida. Importar300 sesiones dos veces mediante Ajustes guarda300 localmente, pero la colección remota devuelve0 durante30s. El trace registra:

```text
Firestore (10.14.1): AsyncQueue Failed to persist write: QuotaExceededError
Failed to execute 'setItem' on 'Storage': Setting the value of
'firestore_mutations_firestore/[DEFAULT]/demo-tai-auth/…_tai-supertest' exceeded the quota.
Firestore (10.14.1): INTERNAL UNHANDLED ERROR: QuotaExceededError
```

Regresión unitaria antes del arreglo:3 ráfagas de300 payloads generan900 escrituras pendientes, frente al máximo esperado300. Tras deduplicar payload pendiente por cuenta/documento:26/26 pruebas de sync pasan, incluidas modificaciones sucesivas, aislamiento de cuentas y reintento tras rechazo. Check global1049 aprobadas/29 omitidas, lint/tipos/arquitectura correctos.

## Ajuste del observador de pruebas

Segunda ejecución75808: ya no aparece QuotaExceededError. La aserción observa30, porque el lector REST de evidencias ignoraba `nextPageToken`. Se implementa paginación acotada100 páginas, abortando tokens repetidos; no se cambia el300 esperado. El acceso sigue usando el token del usuario bajo las reglas del emulador.

Referencia del contrato: [Firestore REST documents.list](https://firebase.google.com/docs/firestore/reference/rest/v1/projects.databases.documents/list). pageToken recupera la página siguiente; pageSize no garantiza que una respuesta incluya todos los documentos.

## Criterio de cierre

La importación repetida debe producir exactamente300 documentos; un contexto nuevo, sin caché de la cuenta, debe recuperar exactamente los300 DTO y mostrar el comparador con delta+20. Resultado final aún en ejecución89922. No se publica el trace bruto porque contiene tokens sintéticos temporales; se conserva localmente en test-results-supertest mientras exista esa ejecución.

La tercera ejecución89922 supera el nuevo recorrido completo (captura restaurada), pero expone un defecto del helper de autenticación: recreaba la identidad del proveedor en el segundo login en vez de seleccionar la existente. Tras reset del usuario, Auth Emulator13.35.1 conserva un índice inconsistente y falla con `User tai-supertest does not have providerInfo google.com`. El helper reutiliza ahora la cuenta visible del proveedor y crea solo si no existe. Se repite desde emuladores nuevos; no se parchea ni debilita Auth.

## Resultado final verificado

Supertest49763: **13/13**,1,7min, código0. La nueva prueba pasa en12,5s; los otros12 recorridos/perfiles pasan tras reutilizar el proveedor. Historial remoto300, recuperación exacta de los300 DTO en contexto limpio, comparación+20 y ausencia de duplicados. Captura `authenticated-history-restored.png` inspeccionada a320px. Sync26/26, check1049/29 omitidas y typecheck final pasan. ATE-015/016 cerrados con esta evidencia; cobertura global ATE-005 sigue abierta.
