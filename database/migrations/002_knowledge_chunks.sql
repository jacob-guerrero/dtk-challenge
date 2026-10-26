CREATE TABLE knowledge_chunks (
  id BIGSERIAL PRIMARY KEY,
  source_id TEXT NOT NULL CHECK (btrim(source_id) <> ''),
  chunk_index INTEGER NOT NULL CHECK (chunk_index >= 0),
  content TEXT NOT NULL CHECK (btrim(content) <> ''),
  search_vector TSVECTOR NOT NULL,
  UNIQUE (source_id, chunk_index)
);

CREATE INDEX knowledge_chunks_search_vector_idx
  ON knowledge_chunks USING GIN (search_vector);
