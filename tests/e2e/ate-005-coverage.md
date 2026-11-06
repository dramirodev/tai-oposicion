# ATE-005: matriz de recorridos y estados

Evidencia vigente: revisión integrada c644a02, referencia76/76, candidata312/44omitidas; Emulator19/19 por separado. Las omisiones no se cuentan como verificaciones. El inventario ARIA de integration-2026-11-06 cuenta observaciones por estado, no controles únicos accionados.

|Funcionalidad/ruta|Perfil y estados|Acción y oráculo|Regresión|
|---|---|---|---|
|Inicio /home|invitado, owner, pendiente, restringido|entrar, continuar, permisos y destinos|routes, home-auth-loading, supertest-emulator|
|Planificación /planificacion|owner; nuevo, sesiones, pausa, próximo día|estudiar, valorar recuerdo, reprogramar, persistencia y siguiente actividad|css-ui, bridge, supertest-emulator|
|Temario /temario|owner; visto/no visto|marcar tema, retorno y autoevaluación|supertest-emulator, bridge|
|Preguntas /test /quiz /result|local y owner; activa, interrumpida, resultado|responder, avanzar, recargar, continuar, finalizar; IDs/índice/respuesta conservados|bridge, react-pages, supertest-emulator|
|Simulacros /sim /sim2 /examenes|owner; oficial, examen, tema, vacío|configurar, responder, corregir y consultar resultado|bridge, supertest-emulator|
|Repaso /falladas|local; vacío, poblado, filtrado, revisado|buscar, filtrar, marcar, practicar; pregunta correcta y marca persistente|failures-empty-state-journey|
|Lectura /lectura|owner; tres pasos y salida|barrera temporal, respuesta, avance y confirmación|supertest-emulator|
|Trampas /trampas y relámpago /relampago|local y permisos owner|opciones, descarte, teclado y destinos|react-pages, css-ui, routes|
|Progreso /stats|local0/2/300, owner300|filtros, comparación+20, recarga y contexto limpio; datos exactos|stats-study-profiles, stats-practice-journey, stats-charts, supertest-emulator|
|Ajustes /settings|local y owner; configuración, copia, error, confirmación|preferencias, agenda, fecha, exportación/importación y persistencia|settings-*-journey, supertest-emulator|
|Accesos /acceso|owner y solicitante simultáneos|aprobar, cancelar con foco, revocar, solicitar, rechazar; restricción efectiva en otro contexto|supertest-emulator|
|Curación /curar-contenido|owner; filtros, evidencia, borrador|crear vínculo, guardar y recargar; evidencia exigida|supertest-emulator|
|Errores /errores y ayuda|local; formulario/navegación|validaciones y destinos|errors-page, help-icons, routes|
|Recuperación de red|owner; Firestore abortado→restablecido|contador de peticiones abortadas>0; checkpoint/ans exactos; resultado interrumpido|supertest-emulator|
|Sesión inválida|owner; refresh token sintético inválido|recarga→login; configuración no nula exacta; reautenticar→Planificación|supertest-emulator|
|Historial entre dispositivos|owner;300 online/offline,latencia500ms|importar dos veces,300 remotos sin duplicados,otro contexto recupera DTO exactos|supertest-emulator|

## Brechas que impiden cerrar ATE-005

- La matriz agrupa recorridos. Falta asignar cada observación del inventario a acción/oráculo y probar los controles dinámicos aún sin correspondencia. No se infiere cobertura por coincidencia de texto.
- Conflicto simultáneo de escritura del mismo registro en dos contextos independientes: falta oráculo específico del contrato vigente y prueba E2E.
- Expiración natural de token y revocación administrativa real: el token inválido sintético no las sustituye.
- Persistencia remota tras recuperar red: Supertest19/19,2,6min; cada ID de sesión local finalizado aparece en la colección remota consultada con token del usuario. Se comprueban IDs, no igualdad completa de todos los campos remotos.

Estado: EN CORRECCIÓN. No equivale a conformidad de accesibilidad ni a cobertura exhaustiva.
