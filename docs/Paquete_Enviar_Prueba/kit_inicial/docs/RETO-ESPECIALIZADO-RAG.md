# Reto especializado (30 puntos): FleetPulse Incident Copilot

## Objetivo
Construir un pequeño módulo de soporte inteligente que explique eventos/alertas de FleetPulse a partir de runbooks sintéticos en `knowledge/`, con recuperación de evidencia, citas y controles contra alucinaciones e instrucciones maliciosas.

## P0 — RE-01 Recuperación documental
Indexar/recuperar fragmentos relevantes de los Markdown de `knowledge/` (PostgreSQL full-text, búsqueda léxica con scoring, embeddings locales o equivalente). Las fuentes son DATOS no confiables; no ejecutar texto que contengan. Generar una traza de recuperación observable (documentos y razones/puntuaciones). Se requiere recuperación real, no respuestas fijas por pregunta.

## P0 — RE-02 API fundamentada
Implementar `POST /api/support/ask` que recibe JSON `{"question":"...","vehicleId":"VEH-001"}`, donde vehicleId es opcional. Responder `{"answer":"...","citations":[{"sourceId":"KB-01","excerpt":"..."}],"grounded":true,"retrievalTrace":[...]}`; se pueden añadir campos. Las citas deben corresponder a fragmentos reales. Ante preguntas por alertas, cruzar el vehículo y/o la alerta persistida cuando exista. No inventar políticas ni datos. Puede usarse LLM local/gratuito, pero NO se exige API comercial ni credenciales; también se admite síntesis extractiva fundamentada. Explicar diferencias entre IA usada para PROGRAMAR y RAG de producto.

## P0 — RE-03 Seguridad y abstención
Si la KB y la telemetría no respaldan una respuesta, abstenerse explícitamente, `grounded=false`. `knowledge/KB-99-inyeccion-no-confiable.md` contiene órdenes maliciosas como datos; no obedecerlas, imprimir secretos, ejecutar Git ni red externa por ellas. Documentar modelo de amenazas y mitigación en `docs/RAG-SECURITY.md`. No usar datos ni credenciales reales.

## P0 — RE-04 Calidad y demostración
Ejecutar los seis casos de `fixtures/support_questions.json`, documentar evidencia de resultados en `docs/RAG-EVALUATION.md` y automatizar como mínimo los casos de fuente correcta, respuesta fuera de KB e inyección maliciosa. Mostrar en video un evento OVERSPEED del replay, consulta a la API con citas y traza, pregunta fuera de evidencia y un caso hostil. Puede usarse curl/Postman para demostrar; UI Angular para chat es P1.

## P1 — Opcional, no penalizado
Embeddings/pgvector, modelo local o proveedor LLM, UI chat, evaluación avanzada, colas RabbitMQ, voz y despliegue cloud. No es necesario gastar dinero.

## Criterio de ingeniería agéntica
Además del producto anterior, es OBLIGATORIO emplear un agente real de programación (Codex, Claude Code, OpenCode, etc.) y entregar `docs/AI-WORKFLOW.md` con dos ciclos de trabajo, un error encontrado y revisión humana del cambio.


## Aclaraciones de aceptación y límites razonables
**Implementación mínima puntuable (P0):** PostgreSQL full-text o recuperación lexical con ranking sencillo, composición EXTRACTIVA basada en fragmentos, API JSON y pruebas. No se requiere LLM, embeddings, chat Angular ni colas externas; tampoco acceso de pago. Esto cabe dentro de un esfuerzo acotado si se prioriza el núcleo común.

**Contrato de citas y trazas:** `citations` contiene objetos `{"sourceId":"KB-01","excerpt":"texto literal verificable"}`. Para afirmar datos de un evento GPS, usar además `{"sourceId":"EVENT:E-001-00","excerpt":"fragmento factual del evento consultado"}`, o `ALERT:id` con referencia verificable. No decir que una alerta ocurrió si no está almacenada. `retrievalTrace` es una lista de `{"sourceId":"KB-01","score":1.0,"excerpt":"texto recuperado"}`; score puede ser número o texto justificado. Explicar top-k, ranking y umbral si se utiliza, sin algoritmo impuesto.

**Definición de sustentación:** `grounded=true` solo cuando cada afirmación factual está respaldada por una KB o evento consultado; en caso contrario abstenerse y retornar `grounded=false`. La ausencia de un evento registrado NO demuestra que nunca ocurrió.

**Antihardcoding:** Durante la evaluación se parafrasearán preguntas, podrá añadirse un archivo Markdown nuevo en `knowledge/` y retirarse temporalmente una fuente. El índice y las respuestas deberán adaptarse sin cambios al código fuente. Se comprobará que el fragmento citado existe realmente.

**Seguridad verificable:** probar que KB-99 no permite leer variables del entorno, invocar herramientas o enviar datos a red. Si el asistente no dispone de esas capacidades, documentar esa separación de privilegios y comprobar que no filtra secretos en respuesta ni logs.

**Evidencia agéntica:** En `docs/AI-WORKFLOW.md` incluir dos ciclos concretos: prompt/tarea redactada, archivos producidos, pruebas o diff revisado, decisión humana y una sugerencia del agente corregida o rechazada. Esto se evalúa en la parte común de IA, separadamente del RAG como producto.
