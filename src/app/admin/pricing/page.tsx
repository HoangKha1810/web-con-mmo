import { AppShell } from '@/components/app-shell';
import { listServices } from '@/lib/services';
import { formatMoney } from '@/lib/utils';

export default async function AdminPricingPage() {
  const services = listServices(undefined, false);

  return (
    <AppShell admin>
      <div className="hero">
        <div className="badge">Pricing</div>
        <h1>Set giá web con</h1>
        <p className="muted">Giá sale_price chỉ lưu ở DB web con, không sửa giá web chính.</p>
        <form action="/api/admin/pricing" method="post" style={{ marginTop: 16 }}>
          <input type="hidden" name="action" value="sync" />
          <button className="btn">Sync dịch vụ từ web chính</button>
        </form>
      </div>
      <div className="table-wrap" style={{ marginTop: 18, overflowX: 'auto' }}>
        <table className="table">
          <thead><tr><th>ID</th><th>Loại</th><th>Dịch vụ</th><th>Base</th><th>Giá web con</th><th>Bật</th><th>Lưu</th></tr></thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.id}>
                <td>#{s.id}</td>
                <td><span className="badge">{s.source}</span></td>
                <td>
                  <form id={`price-${s.id}`} action="/api/admin/pricing" method="post" className="grid">
                    <input type="hidden" name="action" value="update" />
                    <input type="hidden" name="id" value={s.id} />
                    <input className="input" name="display_name" defaultValue={s.display_name} />
                  </form>
                  <div className="muted" style={{ marginTop: 6 }}>{s.category}</div>
                </td>
                <td className="money">{formatMoney(s.base_price)} đ</td>
                <td><input className="input" form={`price-${s.id}`} name="sale_price" type="number" defaultValue={s.sale_price} /></td>
                <td>
                  <select className="select" form={`price-${s.id}`} name="enabled" defaultValue={s.enabled}>
                    <option value="1">Bật</option>
                    <option value="0">Tắt</option>
                  </select>
                </td>
                <td><button className="btn secondary" form={`price-${s.id}`}>Lưu</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
