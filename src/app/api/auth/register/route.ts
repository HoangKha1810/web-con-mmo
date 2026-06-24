import { db } from '@/lib/db';
import { createSession, hashPassword } from '@/lib/auth';
import { fail, isFormRequest, ok, readBody, redirectResponse } from '@/lib/api-response';
import { nowIso } from '@/lib/utils';

export async function POST(req: Request) {
  const body = await readBody(req);
  const fullName = String(body.full_name || '').trim().slice(0, 120);
  const username = String(body.username || '').trim().toLowerCase();
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');

  if (!/^[a-z0-9_]{3,30}$/.test(username)) {
    return fail('Username chỉ gồm chữ, số, gạch dưới và tối thiểu 3 ký tự');
  }
  if (!email.includes('@')) {
    return fail('Email không hợp lệ');
  }
  if (password.length < 6) {
    return fail('Mật khẩu tối thiểu 6 ký tự');
  }

  const exists = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
  if (exists) return fail('Username hoặc email đã tồn tại');

  const now = nowIso();
  const result = db.prepare(`
    INSERT INTO users (username, email, full_name, password_hash, role, status, balance, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'user', 'active', 0, ?, ?)
  `).run(username, email, fullName, hashPassword(password), now, now);

  await createSession(Number(result.lastInsertRowid));
  if (isFormRequest(req) && !req.headers.get('accept')?.includes('application/json')) {
    return redirectResponse(req, '/dashboard');
  }
  return ok({ user: { id: Number(result.lastInsertRowid), username, email, full_name: fullName, role: 'user', balance: 0 } });
}
