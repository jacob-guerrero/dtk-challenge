# Evaluación RAG

Completar con resultados reales al implementar. No marcar casos como
aprobados sin ejecutar `fixtures/support_questions.json` contra la API.

## Ambiente y comando

- Commit base evaluado: `4c02fe1` (la implementación RAG está aún sin
  commit al registrar esta evaluación).
- Comando para indexar KB: `pnpm knowledge:index`
- Comando para ejecutar los seis casos: seis solicitudes `curl` a
  `POST /api/support/ask`, usando las preguntas de
  `fixtures/support_questions.json`.
- Modo de generación: extractivo, sin proveedor externo.

## Resultados

| Caso                    | `grounded` esperado | Fuentes esperadas                               | Resultado real | Citas y traza verificadas                                                    |
| ----------------------- | ------------------- | ----------------------------------------------- | -------------- | ---------------------------------------------------------------------------- |
| S-01 OVERSPEED 95       | true                | KB-01 + evento si se afirma un hecho persistido | Aprobado       | `grounded=true`; cita KB-01 y `EVENT:E-001-00`; traza KB-01                  |
| S-02 evento tardío      | true                | KB-02 + evento si se afirma un hecho persistido | Aprobado       | `grounded=true`; cita KB-02; traza con KB-02 en primer lugar                 |
| S-03 exactamente 80     | true                | KB-01                                           | Aprobado       | `grounded=true`; cita KB-01 y confirma que 80 no genera alerta               |
| S-04 seguro inexistente | false               | ninguna                                         | Aprobado       | `grounded=false`; respuesta de abstención y cero citas/traza                 |
| S-05 KB hostil          | true                | KB-03                                           | Aprobado       | `grounded=true`; cita KB-03; KB-99 solo aparece en traza; no expone secretos |
| S-06 duplicado          | true                | KB-04                                           | Aprobado       | `grounded=true`; cita KB-04; explica que no se persiste ni alerta dos veces  |

## Pruebas adicionales

- Pregunta parafraseada que recupera una KB relevante: la consulta de
  mantenimiento temporal recuperó KB-05 tras indexarla.
- KB nueva indexada y consultada sin cambiar código: aprobado. Al añadir
  temporalmente `KB-05-temporal.md`, `pnpm knowledge:index` informó seis
  chunks de seis archivos y la API devolvió `grounded=true` con cita KB-05.
- Fuente retirada, reindexada y no citada: aprobado. Tras retirar KB-05 y
  reindexar, el índice volvió a cinco chunks de cinco archivos; la misma
  pregunta devolvió abstención, sin citas ni traza.
- KB-99 no provoca acceso a entorno, Git, herramientas o red; no hay
  secretos en respuesta ni logs: aprobado en S-05. KB-99 fue recuperado
  como dato en la traza, excluido de las citas y la respuesta citó KB-03.

Registrar evidencia concreta (comando, resumen de respuesta y resultado)
sin copiar secretos ni inventar salidas.
