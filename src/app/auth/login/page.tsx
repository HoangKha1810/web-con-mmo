import Link from 'next/link';
import { LockKeyhole, Sparkles } from 'lucide-react';
import { AuthForm } from '@/components/auth-form';

export default function LoginPage() {
  return (
    <div className="auth-page">
      <div className="auth-shell reveal">
        <section className="auth-story">
          <div className="brand-lockup">
            <div className="brand-mark">HS</div>
            <div>
              <h1>Hệ Thống Sub</h1>
              <p>Social services marketplace</p>
            </div>
          </div>
          <div className="auth-copy">
            <div className="badge green"><Sparkles size={14} /> Dashboard khách hàng</div>
            <h2>Quản lý đơn SMM và Auto MXH trong một không gian gọn gàng.</h2>
            <p>Đăng nhập để xem bảng giá, nạp số dư, tạo đơn và theo dõi tiến độ xử lý theo thời gian thực.</p>
          </div>
          <div className="auth-metrics">
            <span>Facebook</span>
            <span>TikTok</span>
            <span>Instagram</span>
            <span>YouTube</span>
          </div>
        </section>

        <section className="auth-box form-panel">
          <div className="auth-icon"><LockKeyhole size={26} /></div>
          <h1>Đăng nhập</h1>
          <p className="muted">Vào tài khoản của bạn để tiếp tục đặt dịch vụ.</p>
          <AuthForm mode="login" />
          <p className="muted auth-switch">Chưa có tài khoản? <Link href="/auth/register">Tạo tài khoản mới</Link></p>
        </section>
      </div>
    </div>
  );
}
