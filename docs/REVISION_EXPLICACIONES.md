# Revisión de explicaciones de código

## Cobertura y estado editorial

Una búsqueda heurística de tokens de código y SQL en el banco encontró 177 candidatos posibles. Ese total sirve para orientar la revisión: no es un recuento editorial de preguntas que requieran explicación, porque puede incluir falsos positivos y omitir fragmentos no reconocidos.

El piloto actual contiene cinco explicaciones estáticas en `public/explanations/index.json`: AT303-P1-08, AS06-P1-86, GEN-T3.03-53, GEN-T3.03-58 y GEN-T3.03-71. Todas están marcadas `draft`, muestran que requieren revisión humana y no se presentan como contenido editorial aprobado. Las referencias normativas son enlaces a la Java Language Specification (JLS): cláusulas 14.14 (for), 14.11 (switch), 15.17.3 (resto), 15.22.1 (operadores bit a bit) y 4.2.1–4.2.2 (rango y operaciones enteras). La identificación de Java en los ejemplos se apoya en el uso explícito de `System.out.println`.

No se hizo revisión humana editorial ni se ejecutó código de los ejemplos. El piloto se contrastó estáticamente con las cláusulas enlazadas. En este entorno no hay un JDK disponible para compilar; esa comprobación queda pendiente.

## Cola editorial

- **AT303-P1-09**: no publicar explicación todavía. La expresión `(++i)*salto` no cumple la gramática de `StatementExpression` de la cláusula 14.14.1 del JLS para el tercer componente del `for`, mientras que la clave del banco parece asumir pseudocódigo ejecutable. Se requiere decisión editorial sobre el lenguaje/intención y la clave.
- **AT303-P1-13**: revisar el identificador `índice` frente a `indice`; podrían ser identificadores distintos y el fragmento podría no compilar. No inferir una corrección ni una salida hasta confirmar la intención.

## Contrato de presentación

El índice se descarga junto al banco y se incluye en la caché offline. Las explicaciones se identifican por pregunta y revisión del contenido; una revisión antigua no se muestra. En práctica aparecen tras responder o consultar solución. En simulacros no aparecen durante la sesión, y tampoco se muestran al abandonar una sesión incompleta. El código se escapa como texto y nunca se ejecuta. La exportación o envío a servicios externos no forma parte de esta funcionalidad.
