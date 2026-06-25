import { Banknote, KeyRound, Landmark, WalletCards } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { db } from '@/lib/db';
import { formatDateTimeVi, formatMoney } from '@/lib/utils';

type FundPageParams = {
  ok?: string;
  error?: string;
};

type WithdrawalRow = {
  id: number;
  amount: number;
  note: string;
  username: string | null;
  created_at: string;
};

function statusMessage(params?: FundPageParams) {
  if (params?.ok === 'withdrawn') {
    return { tone: 'success', text: 'Đã ghi nhận số tiền rút vào quỹ web con.' };
  }
  if (params?.error === 'amount') {
    return { tone: 'danger', text: 'Số tiền rút không hợp lệ. Vui lòng nhập số lớn hơn 0.' };
  }
  if (params?.error === 'overdraw') {
    return { tone: 'danger', text: 'Số tiền rút lớn hơn số quỹ còn lại.' };
  }
  return null;
}

export default async function AdminFundsPage({ searchParams }: { searchParams?: Promise<FundPageParams> }) {
  const params = await searchParams;
  const message = statusMessage(params);

  const depositStats = db.prepare(`
    SELECT
      COUNT(*) AS total_requests,
      COALESCE(SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END), 0) AS total_approved,
      COALESCE(SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END), 0) AS approved_count,
      COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) AS total_pending
    FROM deposits
  `).get() as {
    total_requests: number;
    total_approved: number;
    approved_count: number;
    total_pending: number;
  };

  const withdrawalStats = db.prepare(`
    SELECT
      COUNT(*) AS total_withdrawals,
      COALESCE(SUM(amount), 0) AS total_withdrawn
    FROM fund_withdrawals
  `).get() as { total_withdrawals: number; total_withdrawn: number };

  const withdrawals = db.prepare(`
    SELECT w.*, u.username
    FROM fund_withdrawals w
    LEFT JOIN users u ON u.id = w.created_by
    ORDER BY w.id DESC
    LIMIT 200
  `).all() as WithdrawalRow[];

  const totalApproved = Number(depositStats.total_approved || 0);
  const totalWithdrawn = Number(withdrawalStats.total_withdrawn || 0);
  const remaining = totalApproved - totalWithdrawn;

  return (
    <AppShell fundManager>
      <div className="hero fund-hero">
        <div>
          <div className="badge green"><Landmark size={14} /> Quỹ web con</div>
          <h1>Quản lý tiền khách nạp</h1>
          <p className="muted">Theo dõi tổng tiền nạp thành công của web con và ghi nhận số tiền anh đã rút.</p>
        </div>
        <div className="fund-hero-balance">
          <span>Quỹ còn lại</span>
          <strong>{formatMoney(remaining)} đ</strong>
        </div>
      </div>

      <div className="notice fund-login-note">
        <KeyRound size={17} />
        <div>
          <strong>Tài khoản riêng cho màn hình quỹ</strong>
          <span>
            Mặc định: username <code>{process.env.OWNER_USERNAME || 'owner'}</code>. Mật khẩu đặt bằng biến <code>OWNER_PASSWORD</code> trong env VPS.
          </span>
        </div>
      </div>

      {message ? <div className={`notice ${message.tone}`} style={{ marginTop: 18 }}>{message.text}</div> : null}

      <div className="fund-stat-grid">
        <div className="card stat-card fund-stat-card">
          <WalletCards size={24} />
          <div>
            <span>Tổng nạp thành công</span>
            <strong className="money">{formatMoney(totalApproved)} đ</strong>
            <small>{depositStats.approved_count} giao dịch approved</small>
          </div>
        </div>
        <div className="card stat-card fund-stat-card">
          <Banknote size={24} />
          <div>
            <span>Tổng đã rút</span>
            <strong className="money">{formatMoney(totalWithdrawn)} đ</strong>
            <small>{withdrawalStats.total_withdrawals} lần ghi nhận rút</small>
          </div>
        </div>
        <div className="card stat-card fund-stat-card">
          <Landmark size={24} />
          <div>
            <span>Tiền còn lại</span>
            <strong className="money">{formatMoney(remaining)} đ</strong>
            <small>Approved - đã rút</small>
          </div>
        </div>
        <div className="card stat-card fund-stat-card">
          <WalletCards size={24} />
          <div>
            <span>Đang chờ nạp</span>
            <strong className="money">{formatMoney(depositStats.total_pending)} đ</strong>
            <small>{depositStats.total_requests} tổng yêu cầu</small>
          </div>
        </div>
      </div>

      <div className="fund-management-grid">
        <form className="form-panel grid" action="/api/admin/funds" method="post">
          <input type="hidden" name="action" value="withdraw" />
          <div>
            <div className="badge">Withdrawal</div>
            <h2>Ghi nhận tiền đã rút</h2>
            <p className="muted">Khi submit, hệ thống sẽ cộng dồn vào tổng đã rút và trừ khỏi quỹ còn lại.</p>
          </div>
          <label>
            <span className="label">Số tiền rút</span>
            <input className="input input-xl" name="amount" type="number" min="1" step="1000" placeholder="Ví dụ: 500000" required />
          </label>
          <label>
            <span className="label">Ghi chú</span>
            <textarea className="textarea" name="note" placeholder="Ví dụ: Rút về tài khoản cá nhân, ngày đối soát..." />
          </label>
          <button className="btn btn-xl" type="submit">Ghi nhận rút tiền</button>
        </form>

        <div className="table-wrap fund-withdraw-table">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Số tiền</th>
                <th>Người tạo</th>
                <th>Ghi chú</th>
                <th>Ngày tạo</th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.length ? withdrawals.map((item) => (
                <tr key={item.id}>
                  <td>#{item.id}</td>
                  <td className="money">{formatMoney(item.amount)} đ</td>
                  <td>{item.username || 'admin'}</td>
                  <td>{item.note || '-'}</td>
                  <td>{formatDateTimeVi(item.created_at)}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5}>
                    <div className="empty-state compact">Chưa có lịch sử rút tiền.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
