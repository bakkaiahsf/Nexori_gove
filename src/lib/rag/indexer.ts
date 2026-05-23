import prisma from "@/lib/db";
import { embedBatch } from "./embed";

const CHUNK_SIZE = Number(process.env.RAG_CHUNK_SIZE ?? 512);
const CHUNK_OVERLAP = Number(process.env.RAG_CHUNK_OVERLAP ?? 50);

// Approximate token count — 1 token ≈ 4 characters (GPT-3/4 average)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Split text into overlapping windows of ~CHUNK_SIZE tokens.
 * Splits on sentence boundaries where possible, falling back to word boundaries.
 */
function chunkText(text: string): string[] {
  const sentences = text
    .replace(/\r\n/g, "\n")
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.trim().length > 0);

  const chunks: string[] = [];
  let current: string[] = [];
  let currentTokens = 0;

  for (const sentence of sentences) {
    const sentTokens = estimateTokens(sentence);

    if (currentTokens + sentTokens > CHUNK_SIZE && current.length > 0) {
      chunks.push(current.join(" ").trim());

      // Retain overlap: keep trailing sentences until overlap budget exhausted
      let overlapTokens = 0;
      const overlapSentences: string[] = [];
      for (let i = current.length - 1; i >= 0; i--) {
        const t = estimateTokens(current[i]);
        if (overlapTokens + t > CHUNK_OVERLAP) break;
        overlapSentences.unshift(current[i]);
        overlapTokens += t;
      }
      current = overlapSentences;
      currentTokens = overlapTokens;
    }

    current.push(sentence);
    currentTokens += sentTokens;
  }

  if (current.length > 0) {
    chunks.push(current.join(" ").trim());
  }

  return chunks.filter((c) => c.length > 0);
}

export async function indexPolicyDocument(documentId: string): Promise<number> {
  const doc = await prisma.policyDocument.findUniqueOrThrow({
    where: { id: documentId },
    select: { id: true, content: true },
  });

  const chunks = chunkText(doc.content);
  if (chunks.length === 0) return 0;

  // Embed all chunks in one batched call
  const embeddings = await embedBatch(chunks);

  // Delete existing chunks (re-index scenario)
  await prisma.policyChunk.deleteMany({ where: { documentId } });

  // Write chunks with embeddings via raw SQL (Prisma can't write vector type natively)
  await prisma.$transaction(
    chunks.map((text, i) => {
      const embedding = embeddings[i];
      const vectorLiteral = `[${embedding.join(",")}]`;
      return prisma.$executeRaw`
        INSERT INTO policy_chunks (id, "documentId", "chunkIndex", text, embedding, "tokenCount", "createdAt")
        VALUES (
          gen_random_uuid()::text,
          ${documentId},
          ${i},
          ${text},
          ${vectorLiteral}::vector,
          ${estimateTokens(text)},
          NOW()
        )
      `;
    })
  );

  // Mark document as indexed
  await prisma.policyDocument.update({
    where: { id: documentId },
    data: { indexedAt: new Date() },
  });

  return chunks.length;
}
