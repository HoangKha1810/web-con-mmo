import { db, runTx } from '@/lib/db';
import { hashPassword, requireAdmin } from '@/lib/auth';
import { fail, isFormRequest, ok, readBody, redirectResponse } from '@/lib/api-response';
import { nowIso, toNumber } from '@/lib/utils';

function redirectToUsers(req: Request, query = '') {
  return redirectResponse(req, `/admin/users${query}`);
}

function normalizeStatus(value: unknown) {
  const status = String(value || '').trim().toLowerCase();
  return ['active', 'locked'].includes(status) ? status : 'active';
}

function normalizeRole(value: unknown) {
  const role = String(value || '').trim().toLowerCase();
  return ['user', 'admin', 'owner'].includes(role) ? role : 'user';
}

function isProtectedAdminTarget(currentAdminId: number, target: { id: number; role: string }, action: string) {
  if (target.id === currentAdminId && (action === 'delete' || action === 'lock')) return true;
  return false;
}

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

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    const body = await readBody(req);
    const action = String(body.action || '').trim();
    const id = Math.trunc(toNumber(body.id, 0));
    if (!id) {
      if (isFormRequest(req)) return redirectToUsers(req, '?error=user');
      return fail('Thiếu user cần xử lý');
    }

    const target = db.prepare(`
      SELECT id, username, email, full_name, role, status, balance
      FROM users
      WHERE id = ?
      LIMIT 1
    `).get(id) as {
      id: number;
      username: string;
      email: string;
      full_name: string;
      role: string;
      status: string;
      balance: number;
    } | undefined;

    if (!target) {
      if (isFormRequest(req)) return redirectToUsers(req, '?error=user');
      return fail('Không tìm thấy user', 404);
    }

    if (action === 'delete') {
      if (isProtectedAdminTarget(admin.id, target, action)) {
        if (isFormRequest(req)) return redirectToUsers(req, '?error=self');
        return fail('Không thể xóa chính tài khoản admin đang đăng nhập');
      }
      runTx(() => {
        db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
        db.prepare('DELETE FROM users WHERE id = ?').run(id);
      });
      if (isFormRequest(req)) return redirectToUsers(req, '?ok=deleted');
      return ok({ message: 'Đã xóa user' });
    }

    if (action !== 'update') {
      if (isFormRequest(req)) return redirectToUsers(req, '?error=action');
      return fail('Action không hợp lệ');
    }

    const fullName = String(body.full_name || '').trim().slice(0, 120);
    const email = String(body.email || '').trim().toLowerCase();
    const avatarUrl = String(body.avatar_url || '').trim().slice(0, 500);
    const role = normalizeRole(body.role);
    const status = normalizeStatus(body.status);
    const password = String(body.password || '');
    const balance = Math.max(0, Math.trunc(toNumber(body.balance, target.balance)));

    if (!email.includes('@')) {
      if (isFormRequest(req)) return redirectToUsers(req, '?error=email');
      return fail('Email không hợp lệ');
    }
    if (password && password.length < 6) {
      if (isFormRequest(req)) return redirectToUsers(req, '?error=password');
      return fail('Mật khẩu mới tối thiểu 6 ký tự');
    }
    if (isProtectedAdminTarget(admin.id, target, status === 'locked' ? 'lock' : action)) {
      if (isFormRequest(req)) return redirectToUsers(req, '?error=self');
      return fail('Không thể khóa chính tài khoản admin đang đăng nhập');
    }

    const duplicateEmail = db.prepare('SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1').get(email, id);
    if (duplicateEmail) {
      if (isFormRequest(req)) return redirectToUsers(req, '?error=email_exists');
      return fail('Email đã tồn tại');
    }

    const now = nowIso();
    runTx(() => {
      const before = Number(target.balance || 0);
      const delta = balance - before;
      const passwordSql = password ? ', password_hash = ?' : '';
      const params = password
        ? [email, fullName, avatarUrl, role, status, balance, now, hashPassword(password), id]
        : [email, fullName, avatarUrl, role, status, balance, now, id];

      db.prepare(`
        UPDATE users
        SET email = ?, full_name = ?, avatar_url = ?, role = ?, status = ?, balance = ?, updated_at = ?${passwordSql}
        WHERE id = ?
      `).run(...params);

      if (delta !== 0) {
        db.prepare(`
          INSERT INTO ledger (user_id, type, amount, balance_before, balance_after, ref_type, ref_id, note, created_at)
          VALUES (?, 'admin_balance_adjust', ?, ?, ?, 'admin_user', ?, ?, ?)
        `).run(id, delta, before, balance, admin.id, `Admin ${admin.username} chỉnh số dư user #${id}`, now);
      }

      if (status !== 'active') {
        db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
      }
    });

    if (isFormRequest(req)) return redirectToUsers(req, '?ok=updated');
    return ok({ message: 'Đã cập nhật user' });
  } catch (error) {
    if (isFormRequest(req)) return redirectToUsers(req, '?error=server');
    return fail(error instanceof Error ? error.message : 'Không thể xử lý user', 403);
  }
}
