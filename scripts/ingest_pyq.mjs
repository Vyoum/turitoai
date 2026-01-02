#!/usr/bin/env node
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import process from "process";
import OpenAI from "openai";
import { Pinecone } from "@pinecone-database/pinecone";

function getArg(name, defaultValue) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return defaultValue;
  const value = process.argv[idx + 1];
  if (!value || value.startsWith("--")) return defaultValue;
  return value;
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

function stableIdFromText(text) {
  return crypto.createHash("sha1").update(text).digest("hex");
}

function asString(value) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function toEmbeddingText(item) {
  const question =
    asString(item.text) || asString(item.question) || asString(item.prompt);
  const answer = asString(item.answer);
  const chapter = asString(item.chapter);
  const topic = asString(item.topic);
  const topics = Array.isArray(item.topics)
    ? item.topics.map(asString).map((t) => t.trim()).filter(Boolean).join(", ")
    : "";
  const year = asString(item.year);
  const marks = asString(item.marks);

  return [
    chapter ? `Chapter: ${chapter}` : "",
    topic ? `Topic: ${topic}` : "",
    topics ? `Topics: ${topics}` : "",
    year ? `Year: ${year}` : "",
    marks ? `Marks: ${marks}` : "",
    question ? `Question: ${question}` : "",
    answer ? `Answer: ${answer}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath || inputPath.startsWith("--")) {
    console.error(
      "Usage: node scripts/ingest_pyq.mjs <jsonPath> [--namespace <ns>] [--batch <n>]"
    );
    process.exit(1);
  }

  const resolvedPath = path.resolve(process.cwd(), inputPath);
  const namespace = getArg("--namespace", process.env.PINECONE_NAMESPACE || "class10-science");
  const batchSize = Number(getArg("--batch", "50")) || 50;

  const embeddingModel =
    getArg("--embedding-model", process.env.OPENAI_EMBEDDING_MODEL) ||
    "text-embedding-3-small";

  const raw = await fs.readFile(resolvedPath, "utf8");
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) {
    throw new Error("Input JSON must be an array of items.");
  }

  const openai = new OpenAI({ apiKey: requireEnv("OPENAI_API_KEY") });
  const pinecone = new Pinecone({ apiKey: requireEnv("PINECONE_API_KEY") });
  const indexName = requireEnv("PINECONE_INDEX_NAME");
  const host = process.env.PINECONE_HOST;
  const index = host ? pinecone.index(indexName, host) : pinecone.index(indexName);
  const ns = namespace ? index.namespace(namespace) : index;

  console.log(`Loaded ${data.length} items from ${inputPath}`);
  console.log(`Upserting into index: ${indexName}${namespace ? ` (namespace: ${namespace})` : ""}`);
  console.log(`Embedding model: ${embeddingModel}`);

  for (let start = 0; start < data.length; start += batchSize) {
    const batch = data.slice(start, start + batchSize);

    const inputs = batch.map(toEmbeddingText);
    const embeddingResp = await openai.embeddings.create({
      model: embeddingModel,
      input: inputs,
    });

    if (!embeddingResp?.data?.length) {
      throw new Error("No embeddings returned.");
    }

    const vectors = embeddingResp.data.map((row, i) => {
      const item = batch[i] ?? {};
      const text = inputs[i] ?? "";
      const id = asString(item.id) || stableIdFromText(text);

      const metadata = {
        ...item,
        text,
        subject: item.subject ?? "Science",
        classLevel: item.classLevel ?? item.class ?? 10,
      };

      return {
        id,
        values: row.embedding,
        metadata,
      };
    });

    await ns.upsert(vectors);
    console.log(`Upserted ${Math.min(start + batch.length, data.length)}/${data.length}`);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
