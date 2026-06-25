import { LockKeyhole, ShieldCheck, Trash2, Users, WalletCards } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { db } from '@/lib/db';
import { formatDateTimeVi, formatMoney } from '@/lib/utils';

type UserAdminRow = {
  id: number;
  username: string;
  email: string;
  full_name: string;
  avatar_url: string;
  role: string;
  status: string;
  balance: number;
  created_at: string;
};

type UsersPageParams = {
  ok?: string;
  error?: string;
};

function statusMessage(params?: UsersPageParams) {
  if (params?.ok === 'updated') return { tone: 'success', text: 'Đã cập nhật user.' };
  if (params?.ok === 'deleted') return { tone: 'success', text: 'Đã xóa user.' };
  if (params?.error === 'email') return { tone: 'danger', text: 'Email không hợp lệ.' };
  if (params?.error === 'email_exists') return { tone: 'danger', text: 'Email đã tồn tại trên user khác.' };
  if (params?.error === 'password') return { tone: 'danger', text: 'Mật khẩu mới phải tối thiểu 6 ký tự.' };
  if (params?.error === 'self') return { tone: 'danger', text: 'Không thể xóa hoặc khóa chính tài khoản admin đang đăng nhập.' };
  if (params?.error) return { tone: 'danger', text: 'Không thể xử lý user. Vui lòng kiểm tra lại.' };
  return null;
}

export default async function AdminUsersPage({ searchParams }: { searchParams?: Promise<UsersPageParams> }) {
  const params = await searchParams;
  const message = statusMessage(params);
  const users = db.prepare(`
    SELECT id, username, email, full_name, avatar_url, role, status, balance, created_at
    FROM users
    ORDER BY id DESC
    LIMIT 300
  `).all() as UserAdminRow[];

  const totalBalance = users.reduce((sum, user) => sum + Number(user.balance || 0), 0);
  const activeUsers = users.filter((user) => user.status === 'active').length;
  const lockedUsers = users.filter((user) => user.status !== 'active').length;

  return (
    <AppShell admin>
      <div className="hero admin-users-hero">
        <div>
          <div className="badge green"><Users size={14} /> Users</div>
          <h1>Quản lý thành viên</h1>
          <p className="muted">Admin chỉnh trực tiếp số dư, trạng thái, vai trò, thông tin hồ sơ và mật khẩu của user web con.</p>
        </div>
      </div>

      {message ? <div className={`notice ${message.tone}`} style={{ marginTop: 18 }}>{message.text}</div> : null}

      <div className="fund-stat-grid admin-user-stats">
        <div className="card stat-card fund-stat-card">
          <Users size={24} />
          <div>
            <span>Tổng user</span>
            <strong>{users.length}</strong>
            <small>Hiển thị tối đa 300 user mới nhất</small>
          </div>
        </div>
        <div className="card stat-card fund-stat-card">
          <ShieldCheck size={24} />
          <div>
            <span>Đang hoạt động</span>
            <strong>{activeUsers}</strong>
            <small>Tài khoản active</small>
          </div>
        </div>
        <div className="card stat-card fund-stat-card">
          <LockKeyhole size={24} />
          <div>
            <span>Đang khóa</span>
            <strong>{lockedUsers}</strong>
            <small>User bị khóa sẽ bị đăng xuất</small>
          </div>
        </div>
        <div className="card stat-card fund-stat-card">
          <WalletCards size={24} />
          <div>
            <span>Tổng số dư user</span>
            <strong className="money">{formatMoney(totalBalance)} đ</strong>
            <small>Số dư hiện có trên web con</small>
          </div>
        </div>
      </div>

      <div className="table-wrap admin-users-table">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Thành viên</th>
              <th>Email / hồ sơ</th>
              <th>Quyền</th>
              <th>Số dư</th>
              <th>Mật khẩu mới</th>
              <th>Ngày tạo</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const formId = `admin-user-${user.id}`;
              const displayName = user.full_name || user.username;
              return (
                <tr key={user.id}>
                  <td>#{user.id}</td>
                  <td>
                    <div className="user-cell admin-user-cell">
                      <div className="profile-avatar sm">
                        {user.avatar_url ? <img src={user.avatar_url} alt={displayName} /> : <span>{displayName.slice(0, 1).toUpperCase()}</span>}
                      </div>
                      <div>
                        <strong>{displayName}</strong>
                        <span>@{user.username}</span>
                      </div>
                    </div>
                  </td>
                  <td className="admin-user-form-cell">
                    <form id={formId} action="/api/admin/users" method="post" className="admin-user-form">
                      <input type="hidden" name="action" value="update" />
                      <input type="hidden" name="id" value={user.id} />
                      <input className="input" name="full_name" defaultValue={user.full_name} placeholder="Họ tên" />
                      <input className="input" name="email" type="email" defaultValue={user.email} placeholder="Email" required />
                      <input className="input" name="avatar_url" defaultValue={user.avatar_url} placeholder="Avatar URL" />
                    </form>
                  </td>
                  <td>
                    <div className="admin-user-selects">
                      <select className="select" form={formId} name="role" defaultValue={user.role}>
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                        <option value="owner">owner</option>
                      </select>
                      <select className="select" form={formId} name="status" defaultValue={user.status}>
                        <option value="active">active</option>
                        <option value="locked">locked</option>
                      </select>
                    </div>
                  </td>
                  <td>
                    <input className="input admin-balance-input money" form={formId} name="balance" type="number" min="0" step="1000" defaultValue={user.balance} />
                  </td>
                  <td>
                    <input className="input" form={formId} name="password" type="password" placeholder="Để trống nếu không đổi" autoComplete="new-password" />
                  </td>
                  <td>{formatDateTimeVi(user.created_at)}</td>
                  <td>
                    <div className="admin-user-actions">
                      <button className="btn secondary" form={formId} type="submit">Lưu</button>
                      <form action="/api/admin/users" method="post">
                        <input type="hidden" name="action" value="delete" />
                        <input type="hidden" name="id" value={user.id} />
                        <button className="btn danger icon-btn" type="submit" aria-label={`Xóa ${user.username}`}>
                          <Trash2 size={16} />
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
