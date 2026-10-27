import { handleRegret } from '@/server/handlers';

export function POST(request: Request) {
  return handleRegret(request);
}
