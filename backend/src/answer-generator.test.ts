import { describe, expect, it } from 'vitest';
import {
  ExtractiveAnswerGenerator,
  FallbackAnswerGenerator,
  GeminiAnswerGenerator,
  type AnswerGenerationInput,
} from './answer-generator.js';

const input: AnswerGenerationInput = {
  question: '¿Hay alerta a 95 km/h?',
  knowledgeCitations: [
    {
      sourceId: 'KB-01',
      excerpt: 'Una alerta OVERSPEED requiere una velocidad mayor que 80.',
    },
  ],
  eventCitation: {
    sourceId: 'EVENT:E-001-00',
    excerpt: 'vehicleId=VEH-001; speedKph=95',
  },
};

describe('GeminiAnswerGenerator', () => {
  it('uses the server-side interactions endpoint without tools or stored state', async () => {
    let requestUrl = '';
    let requestInit: RequestInit | undefined;
    const generator = new GeminiAnswerGenerator(
      'test-gemini-key',
      'gemini-test-model',
      async (url, init) => {
        requestUrl = url;
        requestInit = init;
        return new Response(
          JSON.stringify({
            steps: [
              {
                type: 'model_output',
                content: [{ type: 'text', text: 'Sí, hay una alerta.' }],
              },
            ],
          }),
          { status: 200 },
        );
      },
    );

    await expect(generator.generate(input)).resolves.toBe(
      'Sí, hay una alerta.',
    );
    expect(requestUrl).toBe(
      'https://generativelanguage.googleapis.com/v1beta/interactions',
    );
    expect(requestInit?.headers).toMatchObject({
      'x-goog-api-key': 'test-gemini-key',
    });
    const body = JSON.parse(String(requestInit?.body)) as {
      model: string;
      store: boolean;
      tools?: unknown;
      input: string;
    };
    expect(body).toMatchObject({
      model: 'gemini-test-model',
      store: false,
    });
    expect(body.tools).toBeUndefined();
    expect(body.input).toContain('KB-01');
    expect(body.input).toContain('EVENT:E-001-00');
  });

  it('falls back to deterministic evidence when the provider fails', async () => {
    const generator = new FallbackAnswerGenerator(
      new GeminiAnswerGenerator(
        'test-gemini-key',
        'gemini-test-model',
        async () => new Response('', { status: 503 }),
      ),
      new ExtractiveAnswerGenerator(),
    );

    await expect(generator.generate(input)).resolves.toContain('Según KB-01');
  });
});
