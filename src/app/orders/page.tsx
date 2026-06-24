import { AppShell } from '@/components/app-shell';
import { requireUser } from '@/lib/auth';
import { listUserOrders } from '@/lib/orders';
import { formatMoney } from '@/lib/utils';

export default async function OrdersPage() {
  const user = await requireUser();
  const orders = listUserOrders(user.id) as any[];

  return (
    <AppShell>
      <div className="hero reveal">
        <div className="badge">Orders</div>
        <h1>Lịch sử đơn hàng</h1>
        <p className="muted">Theo dõi toàn bộ đơn đã tạo, số tiền thanh toán, mã xử lý và trạng thái cập nhật.</p>
      </div>
      <div className="table-wrap reveal" style={{ marginTop: 18, overflowX: 'auto' }}>
        <table className="table">
          <thead><tr><th>ID</th><th>Loại</th><th>Dịch vụ</th><th>Link</th><th>Tiền</th><th>Mã xử lý</th><th>Trạng thái</th><th>Ngày</th></tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>#{o.id}</td>
                <td><span className="badge">{o.source}</span></td>
                <td>{o.service_name}</td>
                <td style={{ maxWidth: 260, wordBreak: 'break-word' }}>{o.link}</td>
                <td className="money">{formatMoney(o.amount)} đ</td>
                <td>{o.upstream_order || '-'}</td>
                <td><span className="badge">{o.status}</span></td>
                <td>{o.created_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
