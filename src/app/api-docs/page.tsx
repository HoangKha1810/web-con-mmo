import { AppShell } from '@/components/app-shell';

const baseUrl = 'https://hethongsub.vn';

export default function ApiDocsPage() {
  return (
    <AppShell>
      <div className="hero">
        <div className="badge green">API Docs</div>
        <h1>Tài liệu API Hệ Thống Sub</h1>
        <p className="muted">Các endpoint dành cho tài khoản đã đăng nhập để tạo yêu cầu nạp tiền, đặt đơn SMM và theo dõi lịch sử xử lý. Lệnh nạp được duyệt sẽ cộng cả ví web con và ví nguồn API key trên web chính.</p>
      </div>
      <div className="grid grid-2" style={{ marginTop: 18 }}>
        <div className="card">
          <h2>Tạo yêu cầu nạp tiền</h2>
          <pre className="code">{`curl -X POST '${baseUrl}/api/deposits' \\
  --cookie 'hss_session=...' \\
  -F amount=100000 \\
  -F note='Nạp bank'`}</pre>
        </div>
        <div className="card">
          <h2>API webhook cộng tiền</h2>
          <pre className="code">{`curl -X POST '${baseUrl}/api/external/deposits' \\
  -H 'x-admin-secret: SESSION_SECRET' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "username": "demo",
    "amount": 100000,
    "external_ref": "BANK123",
    "note": "Nạp tự động"
  }'`}</pre>
        </div>
        <div className="card">
          <h2>Kiểm tra số dư nguồn</h2>
          <pre className="code">{`curl '${baseUrl}/api/admin/source-balance' \\
  --cookie 'hss_session=...'`}</pre>
        </div>
        <div className="card">
          <h2>Tạo đơn SMM</h2>
          <pre className="code">{`curl -X POST '${baseUrl}/api/orders/smm' \\
  --cookie 'hss_session=...' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "service_id": 1,
    "link": "https://facebook.com/...",
    "quantity": 1000
  }'`}</pre>
        </div>
        <div className="card">
          <h2>Tạo đơn AutoMXH</h2>
          <pre className="code">{`curl -X POST '${baseUrl}/api/orders/automxh' \\
  --cookie 'hss_session=...' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "service_id": 2,
    "link": "https://facebook.com/...",
    "buyer_info": "zalo"
  }'`}</pre>
        </div>
      </div>
    </AppShell>
  );
}
