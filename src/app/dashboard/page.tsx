import Link from 'next/link';
import { ArrowRight, CheckCircle2, Clock3, Package, Wallet } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { listServices } from '@/lib/services';
import { formatMoney } from '@/lib/utils';

export default async function DashboardPage() {
  const user = await requireUser();
  const serviceCount = listServices(undefined, true).length;
  const orderCount = (db.prepare('SELECT COUNT(*) AS total FROM orders WHERE user_id = ?').get(user.id) as { total: number }).total;
  const processingOrders = (db.prepare("SELECT COUNT(*) AS total FROM orders WHERE user_id = ? AND status = 'processing'").get(user.id) as { total: number }).total;
  const completedOrders = (db.prepare("SELECT COUNT(*) AS total FROM orders WHERE user_id = ? AND status = 'completed'").get(user.id) as { total: number }).total;

  return (
    <AppShell>
      <div className="hero dashboard-hero reveal">
        <div>
          <div className="badge green">Social Boost Platform</div>
          <h1>Đặt dịch vụ mạng xã hội nhanh hơn, rõ giá hơn</h1>
          <p className="muted">
            Hệ Thống Sub tập trung các dịch vụ tăng trưởng và hỗ trợ tài khoản cho Facebook, TikTok, Instagram, YouTube. Chọn gói, nhập thông tin, theo dõi đơn ngay trong một dashboard.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 22 }}>
            <Link className="btn btn-lg" href="/services/smm">Khám phá SMM <ArrowRight size={18} /></Link>
            <Link className="btn secondary btn-lg" href="/services/automxh">Dịch vụ Auto MXH</Link>
          </div>
        </div>
        <div className="hero-preview">
          <div className="preview-card active">
            <span>Facebook</span>
            <strong>Tăng like, comment, follow</strong>
          </div>
          <div className="preview-card">
            <span>TikTok</span>
            <strong>Tim, view, live, follow</strong>
          </div>
          <div className="preview-card">
            <span>Account Care</span>
            <strong>Mở khóa, verify, bảo mật</strong>
          </div>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginTop: 18 }}>
        <div className="stat-card reveal"><Wallet size={22} /><div><span>Số dư khả dụng</span><strong className="money">{formatMoney(user.balance)} đ</strong></div></div>
        <div className="stat-card reveal"><Package size={22} /><div><span>Dịch vụ đang bán</span><strong>{serviceCount}</strong></div></div>
        <div className="stat-card reveal"><Clock3 size={22} /><div><span>Đơn đang xử lý</span><strong>{processingOrders}</strong></div></div>
        <div className="stat-card reveal"><CheckCircle2 size={22} /><div><span>Tổng đơn của bạn</span><strong>{orderCount || completedOrders}</strong></div></div>
      </div>

      <div className="grid grid-3" style={{ marginTop: 18 }}>
        <Link className="feature-card reveal" href="/services/smm">
          <span className="social-mark blue">f</span>
          <h3>SMM theo nền tảng</h3>
          <p>Chọn Facebook, TikTok, Instagram hoặc YouTube, sau đó chọn đúng nhóm dịch vụ cần chạy.</p>
        </Link>
        <Link className="feature-card reveal" href="/services/automxh">
          <span className="social-mark cyan">♪</span>
          <h3>Auto MXH</h3>
          <p>Các gói hỗ trợ tài khoản, xác minh, mở khóa, bảo mật và xử lý lỗi theo từng nền tảng.</p>
        </Link>
        <Link className="feature-card reveal" href="/wallet">
          <span className="social-mark green">₫</span>
          <h3>Nạp tiền nhanh</h3>
          <p>Tạo yêu cầu nạp, theo dõi trạng thái duyệt và sử dụng số dư để đặt đơn ngay.</p>
        </Link>
      </div>
    </AppShell>
  );
}
