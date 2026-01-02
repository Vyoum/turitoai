import OpenAI from "openai";
import { getRequiredEnv } from "./env";

let cachedClient;

export function getOpenAIClient() {
  if (cachedClient) return cachedClient;
  cachedClient = new OpenAI({
    apiKey: getRequiredEnv("OPENAI_API_KEY"),
  });
  return cachedClient;
}
