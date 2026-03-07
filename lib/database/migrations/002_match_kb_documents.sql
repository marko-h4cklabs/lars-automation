-- pgvector similarity search function for RAG
-- Requires: pgvector extension (already enabled in 001_initial_schema)

CREATE OR REPLACE FUNCTION match_kb_documents(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  type kb_document_type,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    kb.id,
    kb.title,
    kb.content,
    kb.type,
    1 - (kb.embedding <=> query_embedding) AS similarity
  FROM kb_documents kb
  WHERE
    kb.is_active = true
    AND kb.embedding IS NOT NULL
    AND 1 - (kb.embedding <=> query_embedding) > match_threshold
  ORDER BY kb.embedding <=> query_embedding
  LIMIT match_count;
$$;
