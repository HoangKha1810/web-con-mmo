import { AppShell } from '@/components/app-shell';
import { getOrderFinancialSummary, listAllOrders } from '@/lib/orders';
import { formatMoney } from '@/lib/utils';

export default async function AdminOrdersPage() {
  const orders = listAllOrders() as any[];
  const summary = getOrderFinancialSummary();

  return (
    <AppShell admin>
      <div className="hero">
        <div className="badge">Orders</div>
        <h1>Quản lý đơn web con</h1>
        <p className="muted">Xem đơn khách mua, giá nguồn, giá bán web con và lời theo từng đơn.</p>
      </div>
      <div className="grid grid-4" style={{ marginTop: 18 }}>
        <div className="card"><div className="muted">Đơn tính doanh thu</div><h2>{summary.billableOrders}</h2></div>
        <div className="card"><div className="muted">Tổng giá nguồn</div><h2 className="money">{formatMoney(summary.totalSourceAmount)} đ</h2></div>
        <div className="card"><div className="muted">Tổng giá web con</div><h2 className="money">{formatMoney(summary.totalSaleAmount)} đ</h2></div>
        <div className="card"><div className="muted">Tổng lời</div><h2 className="money">{formatMoney(summary.totalProfitAmount)} đ</h2></div>
      </div>
      <div className="table-wrap" style={{ marginTop: 18, overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>User</th>
              <th>Loại</th>
              <th>Dịch vụ</th>
              <th>SL</th>
              <th>Giá nguồn</th>
              <th>Giá web con</th>
              <th>Lời</th>
              <th>Upstream</th>
              <th>Status</th>
              <th>Check</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const profit = Number(o.profit_amount || 0);
              return (
                <tr key={o.id}>
                  <td>#{o.id}</td>
                  <td>{o.username}<div className="muted">{o.email}</div></td>
                  <td><span className="badge">{o.source}</span></td>
                  <td>{o.service_name}<div className="muted" style={{ maxWidth: 260, wordBreak: 'break-word' }}>{o.link}</div></td>
                  <td>{formatMoney(o.quantity)}</td>
                  <td className="money">{formatMoney(o.source_amount)} đ</td>
                  <td className="money">{formatMoney(o.amount)} đ</td>
                  <td className="money" style={{ color: profit < 0 ? 'var(--danger)' : undefined }}>{formatMoney(profit)} đ</td>
                  <td>{o.upstream_order || '-'}</td>
                  <td><span className="badge">{o.status}</span><div className="muted">{o.error_message}</div></td>
                  <td>
                    <form action="/api/admin/orders" method="post">
                      <input type="hidden" name="id" value={o.id} />
                      <button className="btn secondary">Refresh</button>
                    </form>
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
