import { handleChat } from '@/server/handlers';

export function POST(request: Request) {
  return handleChat(request);
}
