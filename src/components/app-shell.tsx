import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CreditCard, FileText, Gauge, Package, ReceiptText, Settings, Shield, Sparkles, UserRound, Wallet } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { ThemeToggle } from '@/components/theme-toggle';
import { SidebarAccount, TopbarAccount } from '@/components/account-widgets';

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

        <SidebarAccount initialUser={user} admin={admin} />
      </aside>
      <main className="main">
        <div className="topbar">
          <div className="topbar-copy">
            <div className="badge green"><Sparkles size={14} /> hethongsub.vn</div>
            <p>Đặt dịch vụ nhanh, theo dõi đơn rõ ràng, bảng giá minh bạch.</p>
          </div>
          <div className="topbar-actions">
            <ThemeToggle />
            <TopbarAccount initialUser={user} />
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
