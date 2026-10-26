import { readdir, readFile } from 'node:fs/promises';
import { Client } from 'pg';
import { fileURLToPath } from 'node:url';

const knowledgeDirectory = fileURLToPath(
  new URL(
    '../docs/Paquete_Enviar_Prueba/kit_inicial/knowledge/',
    import.meta.url,
  ),
);
const chunkSize = 800;

function sourceIdFor(fileName: string) {
  const baseName = fileName.replace(/\.md$/i, '');
  return baseName.match(/^(KB-\d+)/i)?.[1]?.toUpperCase() ?? baseName;
}

function chunk(content: string) {
  const paragraphs = content
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let current = '';

  for (const paragraph of paragraphs) {
    if (current && current.length + paragraph.length + 2 > chunkSize) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
  }
  if (current) {
    chunks.push(current);
  }
  return chunks;
}

async function indexKnowledge() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL must be set.');
  }

  const files = (await readdir(knowledgeDirectory))
    .filter((fileName) => fileName.endsWith('.md'))
    .sort();
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM knowledge_chunks');

    let count = 0;
    for (const fileName of files) {
      const content = await readFile(
        `${knowledgeDirectory}${fileName}`,
        'utf8',
      );
      for (const [chunkIndex, text] of chunk(content).entries()) {
        await client.query(
          `INSERT INTO knowledge_chunks (source_id, chunk_index, content, search_vector)
           VALUES ($1, $2, $3, to_tsvector('simple', $3))`,
          [sourceIdFor(fileName), chunkIndex, text],
        );
        count += 1;
      }
    }

    await client.query('COMMIT');
    console.log(
      `Indexed ${count} chunks from ${files.length} knowledge files.`,
    );
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

indexKnowledge().catch((error: unknown) => {
  console.error(
    'Knowledge indexing failed:',
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
