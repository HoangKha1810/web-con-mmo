import { db } from '@/lib/db';
import { fail, ok, readBody } from '@/lib/api-response';
import { hashPassword, requireUser, verifyPassword } from '@/lib/auth';
import { nowIso } from '@/lib/utils';

function validAvatarUrl(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

function isFormPost(req: Request) {
  const contentType = req.headers.get('content-type') || '';
  return contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data');
}

function redirectToProfile(req: Request, status: string) {
  return new Response(null, {
    status: 303,
    headers: { Location: `/profile?updated=${encodeURIComponent(status)}` },
  });
}

export async function GET() {
  try {
    const user = await requireUser();
    return ok({ user });
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Bạn cần đăng nhập', 401);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await readBody(req);
    const action = String(body.action || 'profile').trim();
    const now = nowIso();

    if (action === 'profile') {
      const fullName = String(body.full_name || '').trim().slice(0, 120);
      const email = String(body.email || '').trim().toLowerCase();
      const avatarUrl = String(body.avatar_url || '').trim();

      if (!email.includes('@')) {
        if (isFormPost(req)) return redirectToProfile(req, 'email-invalid');
        return fail('Email không hợp lệ');
      }
      if (!validAvatarUrl(avatarUrl)) {
        if (isFormPost(req)) return redirectToProfile(req, 'avatar-invalid');
        return fail('Avatar URL phải là link http/https hợp lệ');
      }

      const exists = db.prepare('SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1').get(email, user.id);
      if (exists) {
        if (isFormPost(req)) return redirectToProfile(req, 'email-exists');
        return fail('Email này đã được tài khoản khác sử dụng');
      }

      db.prepare(`
        UPDATE users
        SET full_name = ?, email = ?, avatar_url = ?, updated_at = ?
        WHERE id = ?
      `).run(fullName, email, avatarUrl, now, user.id);

      if (isFormPost(req)) {
        return redirectToProfile(req, 'profile');
      }
      return ok({ message: 'Đã cập nhật hồ sơ' });
    }

    if (action === 'password') {
      const currentPassword = String(body.current_password || '');
      const newPassword = String(body.new_password || '');
      const confirmPassword = String(body.confirm_password || '');
      if (newPassword.length < 6) {
        if (isFormPost(req)) return redirectToProfile(req, 'password-short');
        return fail('Mật khẩu mới tối thiểu 6 ký tự');
      }
      if (newPassword !== confirmPassword) {
        if (isFormPost(req)) return redirectToProfile(req, 'password-mismatch');
        return fail('Mật khẩu xác nhận không khớp');
      }

      const row = db.prepare('SELECT password_hash FROM users WHERE id = ? LIMIT 1').get(user.id) as { password_hash: string } | undefined;
      if (!row || !verifyPassword(currentPassword, row.password_hash)) {
        if (isFormPost(req)) return redirectToProfile(req, 'password-current');
        return fail('Mật khẩu hiện tại không đúng', 401);
      }

      db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(hashPassword(newPassword), now, user.id);
      if (isFormPost(req)) {
        return redirectToProfile(req, 'password');
      }
      return ok({ message: 'Đã đổi mật khẩu' });
    }

    return fail('Action không hợp lệ');
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Không thể cập nhật hồ sơ', 400);
  }
}
