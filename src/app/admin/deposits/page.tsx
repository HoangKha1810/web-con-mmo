import { AppShell } from '@/components/app-shell';
import { db } from '@/lib/db';
import { formatDateTimeVi, formatMoney } from '@/lib/utils';

export default async function AdminDepositsPage() {
  const stats = db.prepare(`
    SELECT
      COUNT(*) AS total_requests,
      COALESCE(SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END), 0) AS total_approved,
      COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) AS total_pending_amount,
      COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pending_count
    FROM deposits
  `).get() as {
    total_requests: number;
    total_approved: number;
    total_pending_amount: number;
    pending_count: number;
  };

  const deposits = db.prepare(`
    SELECT d.*, u.username
    FROM deposits d
    JOIN users u ON u.id = d.user_id
    ORDER BY d.id DESC
    LIMIT 300
  `).all() as any[];

  return (
    <AppShell admin>
      <div className="hero">
        <div className="badge">Deposits</div>
        <h1>Duyệt nạp tiền</h1>
        <p className="muted">Duyệt sẽ cộng tiền vào ví web con của user.</p>
      </div>
      <div className="deposit-admin-stats reveal">
        <div className="card stat-card">
          <span>Tổng nạp thành công</span>
          <strong className="money">{formatMoney(stats.total_approved)} đ</strong>
        </div>
        <div className="card stat-card">
          <span>Đang chờ duyệt</span>
          <strong>{stats.pending_count}</strong>
          <small className="money">{formatMoney(stats.total_pending_amount)} đ</small>
        </div>
        <div className="card stat-card">
          <span>Tổng yêu cầu nạp</span>
          <strong>{stats.total_requests}</strong>
        </div>
      </div>
      <div className="table-wrap" style={{ marginTop: 18, overflowX: 'auto' }}>
        <table className="table">
          <thead><tr><th>ID</th><th>User</th><th>Tiền</th><th>Nội dung</th><th>Trạng thái</th><th>Ngày tạo</th><th>Thao tác</th></tr></thead>
          <tbody>
            {deposits.map((d) => (
              <tr key={d.id}>
                <td>#{d.id}</td>
                <td>{d.username}</td>
                <td className="money">{formatMoney(d.amount)} đ</td>
                <td>{d.content}<div className="muted">{d.note}</div></td>
                <td><span className="badge">{d.status}</span></td>
                <td>{formatDateTimeVi(d.created_at)}</td>
                <td>
                  {d.status === 'pending' ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <form action="/api/admin/deposits" method="post">
                        <input type="hidden" name="id" value={d.id} />
                        <input type="hidden" name="action" value="approve" />
                        <button className="btn">Duyệt</button>
                      </form>
                      <form action="/api/admin/deposits" method="post">
                        <input type="hidden" name="id" value={d.id} />
                        <input type="hidden" name="action" value="reject" />
                        <button className="btn danger">Từ chối</button>
                      </form>
                    </div>
                  ) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
