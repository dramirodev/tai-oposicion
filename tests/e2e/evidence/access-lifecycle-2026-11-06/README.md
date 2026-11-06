# UX-023 y ATE-005: ciclo real de permisos

Solo demo-tai-auth, usuarios owner/pending@example.test, app4191 y emuladores9099/8080. Preparación sintética con mecanismo existente; aprobar/revocar/solicitar/rechazar se ejecutan desde UI.

Antes:14 aprobadas/1 fallida (45711), Escape no devuelve foco a Revocar. El activador estaba disabled mientras el diálogo intentaba restaurarlo.

Después: lock interno desde primer clic, pending visual solo al iniciar escritura tras confirmación. Componente3/3 (incluye doble clic y cambio de cuenta/desmontaje); check1050/29 omitidas, lint/tipos/arquitectura correctos. Supertest40237:15/15,2min.

| Control/estado | Acción | Oráculo |
|---|---|---|
| Aprobar solicitud | clic propietario | fila pasa a Revocar; otro contexto recibe Acceso completo aprobado y abre Planificación |
| Revocar / diálogo | Escape | cierra y devuelve foco; otro usuario conserva acceso tras reload |
| Revocar / confirmado | confirmar | fila desaparece; otro usuario queda limitado y ruta protegida vuelve a Inicio |
| Pedir acceso completo | clic solicitante | reaparece solicitud en propietario |
| Rechazar / confirmado | confirmar | desaparece solicitud; solicitante puede pedir de nuevo y sigue limitado tras reload |

Capturas finales separan ambos contextos. No equivale a revisión completa WCAG ni cobertura de todos los errores de red/permisos.
