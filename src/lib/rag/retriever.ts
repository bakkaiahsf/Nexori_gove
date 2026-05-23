import prisma from "@/lib/db";
import { embedText, embeddingToSql } from "./embed";

const TOP_K_SEMANTIC = Number(process.env.RAG_TOP_K_SEMANTIC ?? 5);
const TOP_K_KEYWORD = Number(process.env.RAG_TOP_K_KEYWORD ?? 3);
const MIN_SIMILARITY = Number(process.env.RAG_MIN_SIMILARITY_THRESHOLD ?? 0.72);

export interface RetrievedChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  text: string;
  tokenCount: number;
  score: number;
  retrievalMethod: "semantic" | "keyword";
}

type RawSemanticRow = {
  id: string;
  documentId: string;
  chunkIndex: number;
  text: string;
  tokenCount: number;
  distance: number;
};

type RawKeywordRow = {
  id: string;
  documentId: string;
  chunkIndex: number;
  text: string;
  tokenCount: number;
  rank: number;
};

async function semanticSearch(
  queryEmbedding: number[],
  topK: number,
  tenantDocIds: string[] | null
): Promise<RetrievedChunk[]> {
  const vectorLiteral = embeddingToSql(queryEmbedding);

  // pgvector cosine distance — lower is better (<=> operator)
  // We filter by 1 - distance >= MIN_SIMILARITY  →  distance <= 1 - MIN_SIMILARITY
  const maxDistance = 1 - MIN_SIMILARITY;

  const rows: RawSemanticRow[] = tenantDocIds
    ? await prisma.$queryRaw`
        SELECT pc.id, pc."documentId", pc."chunkIndex", pc.text, pc."tokenCount",
               (pc.embedding <=> ${vectorLiteral}::vector) AS distance
        FROM policy_chunks pc
        WHERE pc."documentId" = ANY(${tenantDocIds}::text[])
          AND (pc.embedding <=> ${vectorLiteral}::vector) <= ${maxDistance}
        ORDER BY distance
        LIMIT ${topK}
      `
    : await prisma.$queryRaw`
        SELECT pc.id, pc."documentId", pc."chunkIndex", pc.text, pc."tokenCount",
               (pc.embedding <=> ${vectorLiteral}::vector) AS distance
        FROM policy_chunks pc
        WHERE (pc.embedding <=> ${vectorLiteral}::vector) <= ${maxDistance}
        ORDER BY distance
        LIMIT ${topK}
      `;

  return rows.map((r) => ({
    id: r.id,
    documentId: r.documentId,
    chunkIndex: Number(r.chunkIndex),
    text: r.text,
    tokenCount: Number(r.tokenCount),
    score: 1 - Number(r.distance),
    retrievalMethod: "semantic" as const,
  }));
}

async function keywordSearch(
  query: string,
  topK: number,
  tenantDocIds: string[] | null
): Promise<RetrievedChunk[]> {
  // PostgreSQL full-text search using plainto_tsquery (handles multi-word, no syntax needed)
  const rows: RawKeywordRow[] = tenantDocIds
    ? await prisma.$queryRaw`
        SELECT pc.id, pc."documentId", pc."chunkIndex", pc.text, pc."tokenCount",
               ts_rank(to_tsvector('english', pc.text), plainto_tsquery('english', ${query})) AS rank
        FROM policy_chunks pc
        WHERE pc."documentId" = ANY(${tenantDocIds}::text[])
          AND to_tsvector('english', pc.text) @@ plainto_tsquery('english', ${query})
        ORDER BY rank DESC
        LIMIT ${topK}
      `
    : await prisma.$queryRaw`
        SELECT pc.id, pc."documentId", pc."chunkIndex", pc.text, pc."tokenCount",
               ts_rank(to_tsvector('english', pc.text), plainto_tsquery('english', ${query})) AS rank
        FROM policy_chunks pc
        WHERE to_tsvector('english', pc.text) @@ plainto_tsquery('english', ${query})
        ORDER BY rank DESC
        LIMIT ${topK}
      `;

  return rows.map((r) => ({
    id: r.id,
    documentId: r.documentId,
    chunkIndex: Number(r.chunkIndex),
    text: r.text,
    tokenCount: Number(r.tokenCount),
    score: Number(r.rank),
    retrievalMethod: "keyword" as const,
  }));
}

/**
 * Hybrid retrieval: semantic (pgvector cosine) + keyword (pg full-text).
 * Deduplicates by chunk ID; semantic results take precedence on collision.
 * Returns up to topK total chunks ordered by score descending.
 */
export async function retrieveRelevantChunks(
  query: string,
  tenantId?: string,
  topK = 8
): Promise<RetrievedChunk[]> {
  // Resolve tenant document IDs for filtering if tenantId provided
  let tenantDocIds: string[] | null = null;
  if (tenantId) {
    const docs = await prisma.policyDocument.findMany({
      where: { tenantId },
      select: { id: true },
    });
    tenantDocIds = docs.map((d) => d.id);
    if (tenantDocIds.length === 0) return [];
  }

  const [queryEmbedding, keywordResults] = await Promise.all([
    embedText(query),
    keywordSearch(query, TOP_K_KEYWORD, tenantDocIds),
  ]);

  const semanticResults = await semanticSearch(queryEmbedding, TOP_K_SEMANTIC, tenantDocIds);

  // Merge — semantic wins on duplicate chunk ID
  const seen = new Set<string>();
  const merged: RetrievedChunk[] = [];

  for (const chunk of semanticResults) {
    if (!seen.has(chunk.id)) {
      seen.add(chunk.id);
      merged.push(chunk);
    }
  }
  for (const chunk of keywordResults) {
    if (!seen.has(chunk.id)) {
      seen.add(chunk.id);
      merged.push(chunk);
    }
  }

  return merged.slice(0, topK);
}
