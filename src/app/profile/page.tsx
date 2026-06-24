import { Camera, KeyRound, Mail, UserRound } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { requireUser } from '@/lib/auth';
import { formatMoney } from '@/lib/utils';

const updateMessages: Record<string, { tone: 'success' | 'warning'; text: string }> = {
  profile: { tone: 'success', text: 'Đã lưu hồ sơ tài khoản.' },
  password: { tone: 'success', text: 'Đã đổi mật khẩu mới.' },
  'email-invalid': { tone: 'warning', text: 'Email chưa hợp lệ, vui lòng kiểm tra lại.' },
  'email-exists': { tone: 'warning', text: 'Email này đã được tài khoản khác sử dụng.' },
  'avatar-invalid': { tone: 'warning', text: 'Avatar URL phải là link http/https hợp lệ.' },
  'password-short': { tone: 'warning', text: 'Mật khẩu mới tối thiểu 6 ký tự.' },
  'password-mismatch': { tone: 'warning', text: 'Mật khẩu xác nhận không khớp.' },
  'password-current': { tone: 'warning', text: 'Mật khẩu hiện tại không đúng.' },
};

export default async function ProfilePage({ searchParams }: { searchParams?: Promise<{ updated?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const message = params?.updated ? updateMessages[params.updated] : null;
  const displayName = user.full_name || user.username;
  const initial = displayName.slice(0, 1).toUpperCase();

  return (
    <AppShell>
      <div className="hero profile-hero reveal">
        <div className="profile-identity">
          <div className="profile-avatar xl">
            {user.avatar_url ? <img src={user.avatar_url} alt={displayName} /> : <span>{initial}</span>}
          </div>
          <div>
            <div className="badge green">Profile</div>
            <h1>Hồ sơ tài khoản</h1>
            <p className="muted">Quản lý thông tin cá nhân, ảnh đại diện, email đăng nhập và bảo mật mật khẩu.</p>
          </div>
        </div>
        <div className="hero-stat-card">
          <span>Số dư khả dụng</span>
          <strong>{formatMoney(user.balance)} đ</strong>
          <small>{user.username}</small>
        </div>
      </div>

      {message ? (
        <div className={`notice ${message.tone === 'success' ? 'success' : 'warning'} reveal`} style={{ marginTop: 18 }}>
          {message.text}
        </div>
      ) : null}

      <div className="grid grid-2" style={{ marginTop: 18 }}>
        <form className="form-panel reveal" action="/api/profile" method="post">
          <input type="hidden" name="action" value="profile" />
          <div className="form-section-title">
            <UserRound size={20} />
            <div>
              <h2>Thông tin cá nhân</h2>
              <p className="muted">Cập nhật tên hiển thị, email và avatar URL.</p>
            </div>
          </div>
          <div className="grid" style={{ marginTop: 18 }}>
            <label>
              <span className="label">Họ tên</span>
              <input className="input input-lg" name="full_name" defaultValue={user.full_name} placeholder="Nhập họ tên hoặc tên thương hiệu" />
            </label>
            <label>
              <span className="label">Email</span>
              <div className="input-with-icon">
                <Mail size={18} />
                <input name="email" defaultValue={user.email} type="email" required />
              </div>
            </label>
            <label>
              <span className="label">Avatar URL</span>
              <div className="input-with-icon">
                <Camera size={18} />
                <input name="avatar_url" defaultValue={user.avatar_url} placeholder="https://domain.com/avatar.png" />
              </div>
              <span className="field-hint">Dán link ảnh đại diện dạng http/https. Có thể để trống để dùng ký tự đầu tên.</span>
            </label>
          </div>
          <button className="btn btn-lg" style={{ marginTop: 18, width: '100%' }}>Lưu hồ sơ</button>
        </form>

        <form className="form-panel reveal" action="/api/profile" method="post">
          <input type="hidden" name="action" value="password" />
          <div className="form-section-title">
            <KeyRound size={20} />
            <div>
              <h2>Bảo mật mật khẩu</h2>
              <p className="muted">Đổi mật khẩu định kỳ để bảo vệ tài khoản.</p>
            </div>
          </div>
          <div className="grid" style={{ marginTop: 18 }}>
            <label>
              <span className="label">Mật khẩu hiện tại</span>
              <input className="input input-lg" name="current_password" type="password" required />
            </label>
            <label>
              <span className="label">Mật khẩu mới</span>
              <input className="input input-lg" name="new_password" type="password" minLength={6} required />
            </label>
            <label>
              <span className="label">Nhập lại mật khẩu mới</span>
              <input className="input input-lg" name="confirm_password" type="password" minLength={6} required />
            </label>
          </div>
          <button className="btn secondary btn-lg" style={{ marginTop: 18, width: '100%' }}>Đổi mật khẩu</button>
        </form>
      </div>
    </AppShell>
  );
}
