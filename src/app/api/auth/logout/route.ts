import { clearSession } from '@/lib/auth';
import { isFormRequest, ok, redirectResponse } from '@/lib/api-response';

export async function POST(req: Request) {
  await clearSession();
  if (isFormRequest(req)) {
    return redirectResponse(req, '/auth/login');
  }
  return ok();
}
