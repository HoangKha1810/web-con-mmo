import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { db } from '@/lib/db';
import { getOrderFinancialSummary } from '@/lib/orders';
import { getUpstreamBalance } from '@/lib/upstream';
import { formatMoney } from '@/lib/utils';

export default async function AdminPage() {
  const users = (db.prepare('SELECT COUNT(*) AS total FROM users').get() as { total: number }).total;
  const depositStats = db.prepare(`
    SELECT
      COUNT(*) AS total_requests,
      COALESCE(SUM(amount), 0) AS total_requested,
      COALESCE(SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END), 0) AS total_approved,
      COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) AS total_pending_amount,
      COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pending_count
    FROM deposits
  `).get() as {
    total_requests: number;
    total_requested: number;
    total_approved: number;
    total_pending_amount: number;
    pending_count: number;
  };
  const orderSummary = getOrderFinancialSummary();
  let sourceBalance = 0;
  try { sourceBalance = await getUpstreamBalance(); } catch {}

  return (
    <AppShell admin>
      <div className="hero">
        <div className="badge green">Admin</div>
        <h1>Quản trị Hệ Thống Sub</h1>
        <p className="muted">Quản lý đơn, duyệt nạp, set giá web con không ảnh hưởng web chính.</p>
      </div>
      <div className="grid grid-4" style={{ marginTop: 18 }}>
        <div className="card"><div className="muted">Thành viên</div><h2>{users}</h2></div>
        <div className="card"><div className="muted">Tổng đơn khách mua</div><h2>{orderSummary.billableOrders}</h2><div className="muted">{orderSummary.failedOrders} đơn lỗi/hoàn</div></div>
        <div className="card"><div className="muted">Tổng khách nạp</div><h2 className="money">{formatMoney(depositStats.total_approved)} đ</h2><div className="muted">{depositStats.total_requests} yêu cầu nạp</div></div>
        <div className="card"><div className="muted">Chờ nạp</div><h2>{depositStats.pending_count}</h2><div className="money">{formatMoney(depositStats.total_pending_amount)} đ</div></div>
      </div>
      <div className="grid grid-4" style={{ marginTop: 18 }}>
        <div className="card"><div className="muted">Tổng giá nguồn</div><h2 className="money">{formatMoney(orderSummary.totalSourceAmount)} đ</h2></div>
        <div className="card"><div className="muted">Tổng giá Hệ Thống Sub</div><h2 className="money">{formatMoney(orderSummary.totalSaleAmount)} đ</h2></div>
        <div className="card"><div className="muted">Tổng lời nhận được</div><h2 className="money">{formatMoney(orderSummary.totalProfitAmount)} đ</h2></div>
        <div className="card"><div className="muted">Ví nguồn API</div><h2 className="money">{formatMoney(sourceBalance)} đ</h2></div>
      </div>
      <div style={{ marginTop: 18, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Link className="btn" href="/admin/pricing">Set giá</Link>
        <Link className="btn secondary" href="/admin/deposits">Duyệt nạp</Link>
        <Link className="btn secondary" href="/admin/orders">Quản lý đơn</Link>
      </div>
    </AppShell>
  );
}
