# Instrucciones permanentes para agentes de desarrollo

## Alcance y principio rector

Estas reglas se aplican a todo el repositorio y a cualquier tarea ejecutada por agentes de IA. Este es un proyecto existente: evoluciona, no reconstruyas. Las instrucciones específicas de cada tarea complementan estas reglas, pero no autorizan acciones destructivas implícitas.

## Antes de cambiar código

1. Lee este archivo, el README, la documentación arquitectónica y el handoff existente. Localiza su ruta real; no inventes otra.
2. Inspecciona el árbol del proyecto, scripts, dependencias, modelos, rutas, estado, servicios, persistencia, componentes, estilos y tests relacionados.
3. Ejecuta `git status` y preserva todos los cambios preexistentes, especialmente los no confirmados.
4. Busca implementaciones equivalentes o parciales. Contrasta el handoff con el código: el código es la referencia sobre qué está implementado.
5. Establece una línea base de lint, typecheck, tests y build cuando existan, y documenta los fallos previos.

## Arquitectura y convenciones

- Respeta la arquitectura real del repositorio: estructura de carpetas, convenciones de nombres, contratos, modelos, responsabilidades, hooks, componentes, stores, servicios, rutas, persistencia, sistema de diseño y estrategia de pruebas.
- No impongas arquitecturas nuevas ni reorganices carpetas por preferencia personal.
- Reutiliza y amplía módulos existentes antes de crear otros. Evita duplicar lógica o reconstruir funcionalidades ya desarrolladas.
- Mantén tipado estricto y las convenciones TypeScript actuales; evita `any` innecesario. Separa lógica de dominio, presentación y persistencia siguiendo los patrones ya establecidos.
- No presupongas tecnologías: comprueba si se usan React Router, Zustand, Recharts, Firebase u otras antes de decidir.
- Respeta accesibilidad, diseño responsive y estilos existentes; evita introducir convenciones CSS incompatibles.

## Protección de código, Git y datos

- No elimines funcionalidades, archivos, pruebas, contratos, lógica de negocio o dependencias en uso sin autorización explícita.
- No reescribas módulos completos ni hagas refactorizaciones estructurales ajenas a la tarea.
- No sobrescribas trabajo ajeno ni cambios sin confirmar. No uses `git reset --hard`, `git clean -fd`, restauraciones masivas, `push --force` ni operaciones destructivas equivalentes.
- No cambies contratos públicos sin revisar todos sus consumidores y añadir compatibilidad o migraciones cuando proceda.
- No borres ni migres destructivamente datos, colecciones, documentos, IDs, historiales, reglas de seguridad ni configuración de producción. Las operaciones destructivas requieren aprobación explícita.
- Si detectas código obsoleto o una refactorización deseable, documenta la propuesta en el handoff; no la ejecutes automáticamente.

## Dependencias y algoritmos

1. Busca primero una solución existente dentro del repositorio.
2. Antes de desarrollar un algoritmo no trivial, evalúa librerías mantenidas y compatibles; compara documentación, licencia, tipos, dependencias, tests, mantenimiento y coste de integración.
3. Prefiere reutilizar, después integrar una librería adecuada mediante un adaptador y, por último, implementar desde cero con justificación.
4. No instales bibliotecas para resolver tareas triviales ni para imponer una arquitectura diferente.
5. Documenta la decisión técnica en el handoff; si no puedes verificar datos externos, indícalo.

## Ejecución y calidad

- Trabaja con cambios pequeños, incrementales y comprobables; conserva el comportamiento previo.
- Añade pruebas unitarias y de integración pertinentes; verifica estados vacíos, errores y casos límite.
- Ejecuta los scripts disponibles de lint, typecheck, tests y build después de los cambios. Distingue fallos preexistentes de regresiones y corrige las nuevas.
- No declares una tarea terminada solo porque compila o porque has escrito documentación.
- Si surge una operación peligrosa o un conflicto irresoluble sin riesgo, detén esa operación, documenta el bloqueo y sigue con tareas independientes seguras.

## Handoff y colaboración entre agentes

- Conserva y actualiza el handoff existente tras cada fase relevante: objetivos, decisiones, archivos cambiados, pruebas, resultados, bloqueos y próximos pasos.
- No crees handoffs paralelos sin necesidad. No marques tareas completas sin verificación.
- Revisa tareas pendientes antes de comenzar y continúa las compatibles con el alcance autorizado; no repitas trabajo realizado por otros agentes.
- Deja instrucciones precisas para que otro agente pueda retomar el trabajo sin reconstruir contexto ni descartar avances.

## Lista de control previa a cambios importantes

- ¿Existe ya una implementación reutilizable?
- ¿Respeto arquitectura, nombres, interfaces y estilo?
- ¿Conservo funcionalidades, datos, pruebas y cambios ajenos?
- ¿Es un cambio mínimo y compatible?
- ¿Puedo verificarlo con pruebas y comprobar regresiones?
- ¿Está documentada la decisión y actualizado el handoff?

> **EVOLUCIONAR, NO RECONSTRUIR · REUTILIZAR, NO DUPLICAR · AMPLIAR, NO SUSTITUIR · PRESERVAR, NO DESTRUIR.**
