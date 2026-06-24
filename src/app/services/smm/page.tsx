import { AppShell } from '@/components/app-shell';
import { ServiceCatalog } from '@/components/service-catalog';
import { listServices, syncAllServices } from '@/lib/services';

export default async function SmmServicesPage() {
  let services = listServices('smm', true);
  if (services.length === 0) {
    await syncAllServices().catch(() => null);
    services = listServices('smm', true);
  }

  return (
    <AppShell>
      <div className="hero hero-service reveal">
        <div>
          <div className="badge green">Social Growth</div>
          <h1>Dịch vụ SMM</h1>
          <p className="muted">Tăng trưởng Facebook, TikTok, Instagram, YouTube với bảng giá rõ ràng, thao tác đặt đơn nhanh và theo dõi lịch sử minh bạch.</p>
        </div>
        <div className="hero-stat-card">
          <span>Đang mở bán</span>
          <strong>{services.length}</strong>
          <small>dịch vụ SMM</small>
        </div>
      </div>
      <ServiceCatalog source="smm" services={services} />
    </AppShell>
  );
}
