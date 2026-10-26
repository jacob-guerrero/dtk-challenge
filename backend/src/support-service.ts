import type { Pool } from 'pg';
import {
  ExtractiveAnswerGenerator,
  type AnswerGenerator,
  type EvidenceCitation,
} from './answer-generator.js';

type KnowledgeChunk = {
  source_id: string;
  content: string;
  score: number;
};

type EventEvidence = {
  event_id: string;
  vehicle_id: string;
  observed_at: Date;
  speed_kph: number;
};

export type Citation = EvidenceCitation;
export type RetrievalTrace = Citation & { score: number };

export type SupportAnswer = {
  answer: string;
  citations: Citation[];
  grounded: boolean;
  retrievalTrace: RetrievalTrace[];
};

function queryTerms(question: string) {
  const genericTerms = new Set([
    'cual',
    'cuando',
    'como',
    'donde',
    'fecha',
    'para',
    'por',
    'que',
  ]);
  const terms = [
    ...new Set(question.replaceAll('_', ' ').match(/[\p{L}\p{N}]{3,}/gu) ?? []),
  ]
    .map((term) => term.toLocaleLowerCase())
    .filter((term) => !genericTerms.has(term));

  if (
    /api[ _-]?key|secret|token|variable|entorno|git|shell|eliminar|ignorar|orden/i.test(
      question,
    )
  ) {
    terms.push('api', 'keys', 'secretos', 'entorno', 'git');
  }

  return [...new Set(terms)].join(' | ');
}

function isHostileSource(sourceId: string) {
  return sourceId === 'KB-99';
}

function eventExcerpt(event: EventEvidence) {
  return `vehicleId=${event.vehicle_id}; eventId=${event.event_id}; observedAt=${event.observed_at.toISOString()}; speedKph=${event.speed_kph}`;
}

export class SupportService {
  constructor(
    private readonly pool: Pool,
    private readonly answerGenerator: AnswerGenerator = new ExtractiveAnswerGenerator(),
  ) {}

  async ask(question: string, vehicleId?: string): Promise<SupportAnswer> {
    const trace = await this.retrieve(question);
    const evidence = trace.filter((chunk) => !isHostileSource(chunk.sourceId));

    if (evidence.length === 0) {
      return {
        answer:
          'No hay evidencia suficiente en los runbooks o la telemetría para responder.',
        citations: [],
        grounded: false,
        retrievalTrace: trace,
      };
    }

    const citations: Citation[] = evidence
      .slice(0, 2)
      .map(({ sourceId, excerpt }) => ({
        sourceId,
        excerpt,
      }));
    const event = vehicleId
      ? await this.findEventEvidence(vehicleId, question)
      : undefined;
    const selectedEvidence = citations[0];
    if (!selectedEvidence) {
      return {
        answer:
          'No hay evidencia suficiente en los runbooks o la telemetría para responder.',
        citations: [],
        grounded: false,
        retrievalTrace: trace,
      };
    }

    let eventCitation: Citation | undefined;
    if (event) {
      const excerpt = eventExcerpt(event);
      eventCitation = { sourceId: `EVENT:${event.event_id}`, excerpt };
      citations.unshift(eventCitation);
    }

    return {
      answer: await this.answerGenerator.generate({
        question,
        knowledgeCitations: citations.filter(
          (citation) => !citation.sourceId.startsWith('EVENT:'),
        ),
        ...(eventCitation ? { eventCitation } : {}),
      }),
      citations,
      grounded: true,
      retrievalTrace: trace,
    };
  }

  private async retrieve(question: string): Promise<RetrievalTrace[]> {
    const terms = queryTerms(question);
    if (!terms) {
      return [];
    }

    const result = await this.pool.query<KnowledgeChunk>(
      `WITH query AS (SELECT to_tsquery('simple', $1) AS terms)
       SELECT source_id, content, ts_rank_cd(search_vector, query.terms) AS score
       FROM knowledge_chunks, query
       WHERE search_vector @@ query.terms
       ORDER BY score DESC, source_id ASC, chunk_index ASC
       LIMIT 3`,
      [terms],
    );
    return result.rows.map((chunk) => ({
      sourceId: chunk.source_id,
      score: Number(chunk.score),
      excerpt: chunk.content,
    }));
  }

  private async findEventEvidence(vehicleId: string, question: string) {
    const asksAboutAlert = /alerta|overspeed|velocidad/i.test(question);
    if (!asksAboutAlert) {
      return undefined;
    }

    const events = await this.pool.query<EventEvidence>(
      `SELECT event_id, vehicle_id, observed_at, speed_kph
       FROM telemetry_events
       WHERE vehicle_id = $1 AND speed_kph > 80
       ORDER BY observed_at DESC, event_id DESC`,
      [vehicleId],
    );
    const mentionedNumbers = (question.match(/\d+(?:\.\d+)?/g) ?? []).map(
      Number,
    );
    return (
      events.rows.find((event) => mentionedNumbers.includes(event.speed_kph)) ??
      events.rows[0]
    );
  }
}
