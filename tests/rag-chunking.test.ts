import { describe, it, expect } from "vitest";

// Re-export the private chunkText for testing by extracting the logic
// We test the chunking algorithm directly without importing from indexer
// (which would pull in Prisma/OpenAI at module load time)

const CHUNK_SIZE = 512;
const CHUNK_OVERLAP = 50;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

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

  if (current.length > 0) chunks.push(current.join(" ").trim());

  return chunks.filter((c) => c.length > 0);
}

describe("chunkText", () => {
  it("short text produces a single chunk", () => {
    const text = "This is a short policy sentence. It should fit in one chunk.";
    const chunks = chunkText(text);
    expect(chunks).toHaveLength(1);
  });

  it("empty string produces no chunks", () => {
    expect(chunkText("")).toHaveLength(0);
  });

  it("very long text produces multiple chunks", () => {
    // 600 tokens ≈ 2400 chars — should split into at least 2 chunks
    const sentence = "All AI systems deployed in production must undergo a risk assessment. ";
    const long = sentence.repeat(35); // ~35 * ~16 tokens = ~560 tokens
    const chunks = chunkText(long);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("each chunk stays within CHUNK_SIZE token estimate", () => {
    const sentence = "This is a governance policy sentence covering regulatory obligations. ";
    const long = sentence.repeat(50);
    const chunks = chunkText(long);
    for (const chunk of chunks) {
      expect(estimateTokens(chunk)).toBeLessThanOrEqual(CHUNK_SIZE + estimateTokens(sentence));
    }
  });

  it("consecutive chunks share overlap content", () => {
    const sentence = "Regulatory requirement number {n}. ";
    const long = Array.from({ length: 60 }, (_, i) =>
      sentence.replace("{n}", String(i + 1))
    ).join("");
    const chunks = chunkText(long);
    if (chunks.length > 1) {
      // The last sentence of chunk[0] should appear at the start of chunk[1]
      const endOfFirst = chunks[0].split(".").slice(-2)[0]?.trim() ?? "";
      expect(chunks[1]).toContain(endOfFirst.split(" ").slice(-3).join(" "));
    }
  });
});
