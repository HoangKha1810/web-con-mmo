import { AppShell } from '@/components/app-shell';
import { db } from '@/lib/db';
import { formatMoney } from '@/lib/utils';

export default async function AdminUsersPage() {
  const users = db.prepare(`
    SELECT id, username, email, full_name, avatar_url, role, status, balance, created_at
    FROM users
    ORDER BY id DESC
    LIMIT 300
  `).all() as any[];
  return (
    <AppShell admin>
      <div className="hero">
        <div className="badge">Users</div>
        <h1>Thành viên</h1>
        <p className="muted">Theo dõi hồ sơ, email đăng nhập, vai trò và số dư riêng của từng khách hàng trên web con.</p>
      </div>
      <div className="table-wrap" style={{ marginTop: 18, overflowX: 'auto' }}>
        <table className="table">
          <thead><tr><th>ID</th><th>Thành viên</th><th>Email</th><th>Role</th><th>Trạng thái</th><th>Số dư</th><th>Ngày tạo</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>#{u.id}</td>
                <td>
                  <div className="user-cell">
                    <div className="profile-avatar sm">
                      {u.avatar_url ? <img src={u.avatar_url} alt={u.full_name || u.username} /> : <span>{(u.full_name || u.username).slice(0, 1).toUpperCase()}</span>}
                    </div>
                    <div>
                      <strong>{u.full_name || u.username}</strong>
                      <span>@{u.username}</span>
                    </div>
                  </div>
                </td>
                <td>{u.email}</td>
                <td><span className="badge">{u.role}</span></td>
                <td><span className="badge green">{u.status}</span></td>
                <td className="money">{formatMoney(u.balance)} đ</td>
                <td>{u.created_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
