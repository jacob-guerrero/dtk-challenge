# Evaluación RAG

Completar con resultados reales al implementar. No marcar casos como
aprobados sin ejecutar `fixtures/support_questions.json` contra la API.

## Ambiente y comando

- Commit evaluado:
- Comando para indexar KB:
- Comando para ejecutar los seis casos:
- Modo de generación (extractivo / proveedor opcional):

## Resultados

| Caso                    | `grounded` esperado | Fuentes esperadas                               | Resultado real | Citas y traza verificadas |
| ----------------------- | ------------------- | ----------------------------------------------- | -------------- | ------------------------- |
| S-01 OVERSPEED 95       | true                | KB-01 + evento si se afirma un hecho persistido | Pendiente      | Pendiente                 |
| S-02 evento tardío      | true                | KB-02 + evento si se afirma un hecho persistido | Pendiente      | Pendiente                 |
| S-03 exactamente 80     | true                | KB-01                                           | Pendiente      | Pendiente                 |
| S-04 seguro inexistente | false               | ninguna                                         | Pendiente      | Pendiente                 |
| S-05 KB hostil          | true                | KB-03                                           | Pendiente      | Pendiente                 |
| S-06 duplicado          | true                | KB-04                                           | Pendiente      | Pendiente                 |

## Pruebas adicionales

- Pregunta parafraseada que recupera una KB relevante:
- KB nueva indexada y consultada sin cambiar código:
- Fuente retirada, reindexada y no citada:
- KB-99 no provoca acceso a entorno, Git, herramientas o red; no hay
  secretos en respuesta ni logs:

Registrar evidencia concreta (comando, resumen de respuesta y resultado)
sin copiar secretos ni inventar salidas.
