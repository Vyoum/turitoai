import { Pinecone } from "@pinecone-database/pinecone";
import { getRequiredEnv } from "./env";

let cachedIndex;

export function getPineconeIndex() {
  if (cachedIndex) return cachedIndex;

  const pinecone = new Pinecone({
    apiKey: getRequiredEnv("PINECONE_API_KEY"),
  });

  const indexName = getRequiredEnv("PINECONE_INDEX_NAME");
  const host = process.env.PINECONE_HOST;
  cachedIndex = host ? pinecone.index(indexName, host) : pinecone.index(indexName);

  return cachedIndex;
}
