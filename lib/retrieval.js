import { getOpenAIClient } from "./openai";
import { getPineconeIndex } from "./pinecone";

function asText(value) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function formatMatch(match) {
  const metadata = match?.metadata ?? {};

  const headerParts = [];
  if (metadata.year) headerParts.push(`Year: ${asText(metadata.year)}`);
  if (metadata.chapter) headerParts.push(`Chapter: ${asText(metadata.chapter)}`);
  if (metadata.topic) headerParts.push(`Topic: ${asText(metadata.topic)}`);
  if (!metadata.topic && metadata.topics) {
    const topics = Array.isArray(metadata.topics)
      ? metadata.topics.map(asText).map((t) => t.trim()).filter(Boolean).join(", ")
      : asText(metadata.topics);
    if (topics) headerParts.push(`Topics: ${topics}`);
  }
  if (metadata.marks) headerParts.push(`Marks: ${asText(metadata.marks)}`);

  const header = headerParts.length ? `[${headerParts.join(" | ")}]` : "";
  const text =
    asText(metadata.text) ||
    asText(metadata.question) ||
    asText(metadata.content) ||
    asText(metadata.prompt);

  const combined = [header, text].filter(Boolean).join("\n");
  return combined.trim();
}

export async function retrievePyqSnippets(queryText, options = {}) {
  const openai = getOpenAIClient();
  const embeddingModel =
    process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";

  const embeddings = await openai.embeddings.create({
    model: embeddingModel,
    input: queryText,
  });

  const vector = embeddings?.data?.[0]?.embedding;
  if (!vector) throw new Error("Failed to create query embedding.");

  const namespace = options.namespace ?? process.env.PINECONE_NAMESPACE ?? "class10-science";
  const topK = Number.isFinite(options.topK) ? options.topK : Number(options.topK ?? 12) || 12;
  const filter = options.filter;

  const pineconeIndex = getPineconeIndex();
  const index = namespace ? pineconeIndex.namespace(namespace) : pineconeIndex;
  const results = await index.query({
    vector,
    topK,
    includeMetadata: true,
    ...(filter ? { filter } : {}),
  });

  const matches = results?.matches ?? [];
  const snippets = matches.map(formatMatch).filter(Boolean);

  return { matches, snippets };
}
