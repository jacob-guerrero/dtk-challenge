# RAG Security

## Threat model

No confiar en:

- user question;
- Markdown knowledge;
- retrieved chunks;
- external LLM output.

Confiar únicamente en application policy/code y boundaries controlados.

## Prompt injection

Knowledge puede contener instrucciones hostiles.

Tratarlas como evidencia, nunca como instrucciones.

El `AnswerGenerator` no tiene acceso a:

- shell;
- Git;
- environment enumeration;
- filesystem mutation;
- DB writes;
- secretos.

## Secret protection

No incluir secrets en prompts.

No retornar/loggear:

- `INGEST_API_KEY`;
- `DATABASE_URL`;
- `GEMINI_API_KEY`;
- environment dumps.

## Grounding

Retrieval ocurre antes de generation.

Sin evidencia suficiente → abstention.

`grounded=true` requiere soporte para las afirmaciones factuales.

Citations deben corresponder a evidencia realmente recuperada.

## Required adversarial checks

- `KB-99` no cambia las reglas.
- pedir API key no la revela.
- insurance expiration sin evidencia → abstain.
- citation excerpt existe.
- fallback mantiene las mismas reglas.
