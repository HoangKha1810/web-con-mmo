import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CreditCard, FileText, Gauge, LogOut, Package, ReceiptText, Settings, Shield, Sparkles, UserRound, Wallet } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { formatMoney } from '@/lib/utils';
import { ThemeToggle } from '@/components/theme-toggle';

const nav = [
  { href: '/dashboard', label: 'Tổng quan', icon: Gauge },
  { href: '/services/smm', label: 'SMM Services', icon: Package },
  { href: '/services/automxh', label: 'Auto MXH', icon: Settings },
  { href: '/orders', label: 'Đơn hàng', icon: ReceiptText },
  { href: '/wallet', label: 'Nạp tiền', icon: Wallet },
  { href: '/profile', label: 'Hồ sơ', icon: UserRound },
  { href: '/api-docs', label: 'API Docs', icon: FileText },
];

const adminNav = [
  { href: '/admin', label: 'Admin tổng quan', icon: Shield },
  { href: '/admin/orders', label: 'Quản lý đơn', icon: ReceiptText },
  { href: '/admin/pricing', label: 'Bảng giá bán', icon: CreditCard },
  { href: '/admin/deposits', label: 'Duyệt nạp', icon: Wallet },
  { href: '/admin/users', label: 'Thành viên', icon: Shield },
  { href: '/admin/api-docs', label: 'Docs nạp tiền', icon: FileText },
];

export async function AppShell({ children, admin = false }: { children: React.ReactNode; admin?: boolean }) {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');
  if (admin && user.role !== 'admin') redirect('/dashboard');
  const items = admin ? adminNav : nav;
  const displayName = user.full_name || user.username;
  const avatarInitial = displayName.slice(0, 1).toUpperCase();

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link href="/dashboard" style={{ display: 'block' }}>
          <div className="brand-lockup">
            <div className="brand-mark">HS</div>
            <div>
              <h1>Hệ Thống Sub</h1>
              <p>Social services marketplace</p>
            </div>
          </div>
        </Link>

        <nav className="nav">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <Icon size={17} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="account-card" style={{ marginTop: 24 }}>
          <Link className="sidebar-profile" href="/profile">
            <div className="profile-avatar">
              {user.avatar_url ? <img src={user.avatar_url} alt={displayName} /> : <span>{avatarInitial}</span>}
            </div>
            <div>
              <div className="muted" style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase' }}>Tài khoản</div>
              <div style={{ marginTop: 6, fontWeight: 900 }}>{displayName}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>@{user.username}</div>
            </div>
          </Link>
          <div className="sidebar-balance">
            <span>Balance</span>
            <strong>{formatMoney(user.balance)} đ</strong>
          </div>
          <form action="/api/auth/logout" method="post" style={{ marginTop: 14 }}>
            <button className="btn secondary" style={{ width: '100%' }} type="submit">
              <LogOut size={16} />
              Đăng xuất
            </button>
          </form>
          {user.role === 'admin' ? (
            <Link className="btn" href={admin ? '/dashboard' : '/admin'} style={{ width: '100%', marginTop: 10 }}>
              {admin ? 'Về trang khách' : 'Vào admin'}
            </Link>
          ) : null}
        </div>
      </aside>
      <main className="main">
        <div className="topbar">
          <div className="topbar-copy">
            <div className="badge green"><Sparkles size={14} /> hethongsub.vn</div>
            <p>Đặt dịch vụ nhanh, theo dõi đơn rõ ràng, bảng giá minh bạch.</p>
          </div>
          <div className="topbar-actions">
            <ThemeToggle />
            <Link className="topbar-user" href="/profile">
              <div className="profile-avatar sm">
                {user.avatar_url ? <img src={user.avatar_url} alt={displayName} /> : <span>{avatarInitial}</span>}
              </div>
              <div>
                <span>{displayName}</span>
                <strong>{formatMoney(user.balance)} đ</strong>
              </div>
            </Link>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
