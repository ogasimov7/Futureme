import { geminiConfigured } from '@/server/gemini';

/** Lets the app (and you) check whether AI is configured, without revealing the key. */
export function GET() {
  return Response.json({ ai: geminiConfigured() });
}
