import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { fail, ok } from '@/lib/api-response';

export async function GET() {
  try {
    await requireAdmin();
    const data = db.prepare(`
      SELECT id, username, email, full_name, avatar_url, role, status, balance, created_at, updated_at
      FROM users
      ORDER BY id DESC
      LIMIT 300
    `).all();
    return ok({ data });
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Không có quyền', 403);
  }
}
