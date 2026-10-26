# Rúbrica pública: 100 puntos
## Núcleo común (70), idéntico para los tres candidatos
- 25: Node.js/TypeScript, PostgreSQL, integridad de eventos e idempotencia.
- 15: Angular, streaming SSE/WebSocket y reproductor de eventos GPS.
- 15: pruebas, validación, errores y seguridad básica.
- 10: uso de IA agéntica y decisiones humanas verificadas.
- 5: reproducibilidad, GitHub, CI, README y video.
## Reto especializado (30)
- 10: recuperación real, ranking/fragmentos y trazas verificables.
- 8: respuestas fundamentadas y citas auditables, correlación de contexto, abstención cuando no hay evidencia.
- 8: mitigación de prompt injection, separación de confianza, no filtración de secretos y pruebas.
- 4: razonamiento de arquitectura/eficiencia, evaluación documentada y demostración.
## Evidencia y límites
- Cuatro días calendario desde la comunicación oficial; dedicación recomendada máxima de 16–20 horas efectivas.
- P0 obligatorio; P1 opcional y sin penalización.
- Primera reproducción GPS: 24 entradas, 20 nuevas, 2 duplicadas, 2 rechazadas, 8 vehículos, 4 alertas.
- Segunda reproducción SIN reset: 0 nuevas, 22 duplicadas, 2 rechazadas; no crear nuevas alertas.
- Video 8–12 minutos (máximo 15), repo GitHub y tag entrega-final.
- El producto de recuperación puede funcionar sin LLM de pago y se puntúa por fundamento y seguridad, no por gasto.

## Ejemplos de evaluación suficientes e insuficientes
- Recuperación 10: suficiente = corpus indexado y una pregunta NUEVA recupera fuente relevante; insuficiente = tabla de seis respuestas prefijadas.
- Fundamentación 8: suficiente = texto y evento citados realmente; insuficiente = citar KB inexistente o atribuir velocidad no registrada.
- Seguridad 8: suficiente = prueba de KB hostil sin acceso a entorno/herramientas/red ni secretos; insuficiente = solo decir que el agente es seguro.
- Diseño/evidencia 4: suficiente = explicación de diseño y resultados reproducidos; insuficiente = enumeración genérica de tecnologías.
