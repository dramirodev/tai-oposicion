# Candidatos editoriales del banco

El flujo utiliza el catálogo Astra de 39 preguntas válidas. `patterns.json` conserva los seis patrones, frecuencias, convocatorias y referencias. Un editor o un generador propone el concepto, el enunciado, la solución independiente y cuatro alternativas. El programa construye un QuestionRecord compatible y un manifiesto lateral.

```sh
python3 tools/question-editorial/pipeline.py tools/question-editorial/example-spec.json \
  --curriculum-root '/Volumes/SSD/Google Drive/TEMARIO_OPOSICION/01_Temario' \
  --bank public/data --output /tmp/candidato-tai.json
python3 -m unittest discover -s tools/question-editorial -p 'test_*.py'
```

El resultado inicial es `pending_review` y lleva `np=1`. La referencia exige documento dentro de la raíz, hash de los bytes, página física válida y pasaje literal en esa página. PDF usa el `pdftotext` ya empleado en la auditoría. El ejemplo conserva una pregunta de demostración excluida de evaluación.

Se comprueban esquema, opciones, solución contra clave, justificación individual, patrón del catálogo, fuente, duplicidad por ID y duplicidad de contenido incluso si se permutan las alternativas. Conflictos de fuentes, material esencial ausente, equivalencias confirmadas, contradicción o materia fuera del programa rechazan el candidato. El indicador de longitud solicita atención editorial. No calcula dificultad empírica.

Una revisión JSON independiente añade `revision` (huella devuelta), `reviewer`, `date`, `blindSolution`, `sourceVerified`, `uniqueAnswer`, `rationalesVerified` y `decision` (`accepted` o `rejected`). Debe identificar a otro revisor, coincidir con la solución y verificar las tres condiciones. Se pasa mediante `--review`. Cambiar cualquier campo de la propuesta invalida la revisión. La identidad del revisor debe comprobarse en el proceso editorial, pues este comando local no autentica firmas personales.

La aceptación se refiere al expediente candidato. La integración en el banco requiere una transformación explícita revisada y actualizar el manifiesto de integridad. El comando carece de acceso a Firebase. Las escrituras de preguntas en Firestore requieren autorización específica.

Las evaluaciones semánticas que no se pueden demostrar con estas comprobaciones permanecen en revisión. Los patrones ayudan a diseñar el problema, pero no prueban por sí solos la validez de una clave.

El CLI exige un banco completo con `meta.json`, consulta también sus alias históricos y mantiene la salida fuera de `public` y del directorio del banco. Un rechazo independiente puede justificar una solución distinta. Para aprobar sí se exigen la solución coincidente y las tres verificaciones afirmativas.

Para generar desde un concepto se usa `example-plan.json` en lugar de la propuesta completa. Se aporta objetivo, fuente, respuesta razonada y tres confusiones justificadas. La demanda cognitiva selecciona uno de los seis patrones observados; el programa construye el enunciado y coloca las cuatro alternativas preservando su clave y justificaciones. El estado permanece pendiente hasta revisión independiente. Se permiten planes de cantidades, alcance, conceptos próximos, código, cálculo y actuaciones según las premisas obligatorias de cada plantilla.
