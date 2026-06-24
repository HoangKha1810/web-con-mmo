import { AppShell } from '@/components/app-shell';

export default function AdminApiDocsPage() {
  return (
    <AppShell admin>
      <div className="hero">
        <div className="badge green">Deposit API</div>
        <h1>API Docs nạp tiền web con</h1>
        <p className="muted">Dùng cho webhook ngân hàng hoặc tool nội bộ tự cộng tiền user web con và đồng thời nạp tiền vào tài khoản nguồn của API key admin trên web chính.</p>
      </div>
      <div className="card" style={{ marginTop: 18 }}>
        <h2>POST /api/external/deposits</h2>
        <pre className="code">{`curl -X POST 'https://hethongsub.vn/api/external/deposits' \\
  -H 'x-admin-secret: SESSION_SECRET' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "username": "demo",
    "amount": 100000,
    "external_ref": "BANK_TXN_001",
    "note": "Nạp tự động"
  }'`}</pre>
        <p className="muted" style={{ lineHeight: 1.8 }}>
          Tiền nạp được cộng vào ví user trên web con và gọi API nạp nguồn của web chính bằng UPSTREAM_API_KEY. Khi user mua SMM/AutoMXH, web con trừ ví user, gọi API web chính bằng API key nguồn và web chính trừ tiếp tiền từ tài khoản nguồn đó.
        </p>
      </div>
    </AppShell>
  );
}
