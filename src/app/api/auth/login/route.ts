import { db } from '@/lib/db';
import { createSession, verifyPassword } from '@/lib/auth';
import { fail, isFormRequest, ok, readBody, redirectResponse } from '@/lib/api-response';

export async function POST(req: Request) {
  const body = await readBody(req);
  const login = String(body.login || body.username || '').trim().toLowerCase();
  const password = String(body.password || '');

  const user = db.prepare(`
    SELECT id, username, email, full_name, avatar_url, password_hash, role, status, balance
    FROM users
    WHERE username = ? OR email = ?
    LIMIT 1
  `).get(login, login) as { id: number; username: string; email: string; full_name: string; avatar_url: string; password_hash: string; role: string; status: string; balance: number } | undefined;

  if (!user || !verifyPassword(password, user.password_hash)) {
    return fail('Sai tài khoản hoặc mật khẩu', 401);
  }
  if (user.status !== 'active') {
    return fail('Tài khoản đang bị khóa', 403);
  }

  await createSession(user.id);
  if (isFormRequest(req) && !req.headers.get('accept')?.includes('application/json')) {
    return redirectResponse(req, user.role === 'admin' ? '/admin' : '/dashboard');
  }
  return ok({ user: { id: user.id, username: user.username, email: user.email, full_name: user.full_name, avatar_url: user.avatar_url, role: user.role, balance: user.balance } });
}
