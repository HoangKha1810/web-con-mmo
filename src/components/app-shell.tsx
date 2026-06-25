import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CreditCard, FileText, Gauge, Landmark, Package, ReceiptText, Settings, Shield, Sparkles, UserRound, Wallet } from 'lucide-react';
import { getCurrentUser, isAdminRole, isFundManagerRole } from '@/lib/auth';
import { ThemeToggle } from '@/components/theme-toggle';
import { SidebarAccount, TopbarAccount } from '@/components/account-widgets';
import { BrandLogo } from '@/components/brand-logo';
import { AdminContactBubble } from '@/components/admin-contact-bubble';

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
  { href: '/admin/funds', label: 'Quỹ nạp/rút', icon: Landmark },
  { href: '/admin/users', label: 'Thành viên', icon: Shield },
  { href: '/admin/api-docs', label: 'Docs nạp tiền', icon: FileText },
];

const fundManagerNav = [
  { href: '/admin/funds', label: 'Quỹ nạp/rút', icon: Landmark },
];

export async function AppShell({
  children,
  admin = false,
  fundManager = false,
}: {
  children: React.ReactNode;
  admin?: boolean;
  fundManager?: boolean;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');
  if (admin && !isAdminRole(user.role)) redirect('/dashboard');
  if (fundManager && !isFundManagerRole(user.role)) redirect('/dashboard');
  const items = admin || (fundManager && isAdminRole(user.role)) ? adminNav : fundManager ? fundManagerNav : nav;

  return (
    <div className="shell">
      <aside className="sidebar">
        <BrandLogo href="/dashboard" />

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

        <SidebarAccount initialUser={user} admin={admin || fundManager} />
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
        <AdminContactBubble />
      </main>
    </div>
  );
}
