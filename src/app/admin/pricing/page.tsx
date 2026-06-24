import { AppShell } from '@/components/app-shell';
import { AdminPricingTable } from '@/components/admin-pricing-table';
import { listServices } from '@/lib/services';

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
      <AdminPricingTable services={services} />
    </AppShell>
  );
}
