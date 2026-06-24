import { AppShell } from '@/components/app-shell';
import { ServiceCatalog } from '@/components/service-catalog';
import { listServices, syncAllServices } from '@/lib/services';

export default async function AutoMxhServicesPage() {
  let services = listServices('automxh', true);
  if (services.length === 0) {
    await syncAllServices().catch(() => null);
    services = listServices('automxh', true);
  }

  return (
    <AppShell>
      <div className="hero hero-service reveal">
        <div>
          <div className="badge green">Account Care</div>
          <h1>Dịch vụ Auto MXH</h1>
          <p className="muted">Các gói hỗ trợ tài khoản, xử lý lỗi, bảo mật và tối ưu vận hành mạng xã hội, chia theo từng nền tảng để dễ chọn đúng nhu cầu.</p>
        </div>
        <div className="hero-stat-card">
          <span>Đang mở bán</span>
          <strong>{services.length}</strong>
          <small>gói Auto MXH</small>
        </div>
      </div>
      <ServiceCatalog source="automxh" services={services} />
    </AppShell>
  );
}
