import Link from 'next/link';
import { Sparkles, UserPlus } from 'lucide-react';
import { AuthForm } from '@/components/auth-form';
import { BrandLogo } from '@/components/brand-logo';

export default function RegisterPage() {
  return (
    <div className="auth-page">
      <div className="auth-shell reveal">
        <section className="auth-story">
          <BrandLogo href="/auth/register" />
          <div className="auth-copy">
            <div className="badge green"><Sparkles size={14} /> Tạo tài khoản</div>
            <h2>Bắt đầu đặt dịch vụ chỉ với vài thông tin cơ bản.</h2>
            <p>Sau khi đăng ký, bạn có thể nạp số dư, xem bảng giá theo nền tảng và đặt đơn từ dashboard cá nhân.</p>
          </div>
          <div className="auth-metrics">
            <span>Giá rõ ràng</span>
            <span>Lịch sử đơn</span>
            <span>Ví riêng</span>
          </div>
        </section>

        <section className="auth-box form-panel">
          <div className="auth-icon"><UserPlus size={26} /></div>
          <h1>Đăng ký</h1>
          <p className="muted">Tạo tài khoản để sử dụng bảng dịch vụ.</p>
          <AuthForm mode="register" />
          <p className="muted auth-switch">Đã có tài khoản? <Link href="/auth/login">Đăng nhập</Link></p>
        </section>
      </div>
    </div>
  );
}
