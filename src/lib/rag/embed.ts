import OpenAI from "openai";

const EMBEDDING_MODEL =
  process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";
const EMBEDDING_DIMS = Number(process.env.OPENAI_EMBEDDING_DIMENSIONS ?? 1536);

// Batch size kept low to respect OpenAI rate limits for embedding calls
const BATCH_SIZE = 96;

let _client: OpenAI | null = null;
function client(): OpenAI {
  _client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _client;
}

export async function embedText(text: string): Promise<number[]> {
  const res = await client().embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.trim(),
    dimensions: EMBEDDING_DIMS,
  });
  return res.data[0].embedding;
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const slice = texts.slice(i, i + BATCH_SIZE).map((t) => t.trim());
    const res = await client().embeddings.create({
      model: EMBEDDING_MODEL,
      input: slice,
      dimensions: EMBEDDING_DIMS,
    });
    // API returns items in the same order as input
    results.push(...res.data.sort((a, b) => a.index - b.index).map((d) => d.embedding));
  }
  return results;
}

export function embeddingToSql(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
