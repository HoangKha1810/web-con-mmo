'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import { formatMoney } from '@/lib/utils';

export const ACCOUNT_BALANCE_EVENT = 'hethongsub:account-balance';

export type ShellAccountUser = {
  id: number;
  username: string;
  email?: string;
  full_name?: string;
  avatar_url?: string;
  role: string;
  balance: number;
};

function accountDisplayName(user: ShellAccountUser) {
  return user.full_name || user.username;
}

function avatarInitial(user: ShellAccountUser) {
  return accountDisplayName(user).slice(0, 1).toUpperCase();
}

function applyAccountPayload(current: ShellAccountUser, detail: unknown): ShellAccountUser {
  if (!detail || typeof detail !== 'object') return current;
  const payload = detail as { user?: Partial<ShellAccountUser>; balance?: number };
  const nextUser = payload.user || payload;
  const nextBalance = Number(
    payload.balance !== undefined
      ? payload.balance
      : (nextUser as Partial<ShellAccountUser>).balance !== undefined
        ? (nextUser as Partial<ShellAccountUser>).balance
        : current.balance
  );

  return {
    ...current,
    ...nextUser,
    balance: Number.isFinite(nextBalance) ? nextBalance : current.balance,
  };
}

function publishAccountBalance(user: ShellAccountUser) {
  window.dispatchEvent(new CustomEvent(ACCOUNT_BALANCE_EVENT, {
    detail: { user, balance: user.balance },
  }));
}

function useLiveAccount(initialUser: ShellAccountUser, poll = false) {
  const [user, setUser] = useState(initialUser);

  useEffect(() => {
    setUser(initialUser);
  }, [initialUser]);

  useEffect(() => {
    function handleBalance(event: Event) {
      setUser((current) => applyAccountPayload(current, (event as CustomEvent).detail));
    }

    window.addEventListener(ACCOUNT_BALANCE_EVENT, handleBalance);
    return () => window.removeEventListener(ACCOUNT_BALANCE_EVENT, handleBalance);
  }, []);

  useEffect(() => {
    if (!poll) return;
    let disposed = false;

    async function refreshProfile() {
      if (document.visibilityState !== 'visible') return;
      try {
        const response = await fetch('/api/profile', { cache: 'no-store' });
        const payload = await response.json().catch(() => ({}));
        if (!disposed && response.ok && payload.success && payload.user) {
          setUser((current) => {
            const next = applyAccountPayload(current, { user: payload.user });
            publishAccountBalance(next);
            return next;
          });
        }
      } catch {
        // Keep the last visible balance if the lightweight sync request fails.
      }
    }

    const timer = window.setInterval(refreshProfile, 8000);
    window.addEventListener('focus', refreshProfile);
    document.addEventListener('visibilitychange', refreshProfile);
    void refreshProfile();

    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshProfile);
      document.removeEventListener('visibilitychange', refreshProfile);
    };
  }, [poll]);

  return user;
}

function Avatar({ user, small = false }: { user: ShellAccountUser; small?: boolean }) {
  const name = accountDisplayName(user);
  return (
    <div className={`profile-avatar ${small ? 'sm' : ''}`}>
      {user.avatar_url ? <img src={user.avatar_url} alt={name} /> : <span>{avatarInitial(user)}</span>}
    </div>
  );
}

export function SidebarAccount({ initialUser, admin = false }: { initialUser: ShellAccountUser; admin?: boolean }) {
  const user = useLiveAccount(initialUser);
  const displayName = accountDisplayName(user);

  return (
    <div className="account-card" style={{ marginTop: 24 }}>
      <Link className="sidebar-profile" href="/profile">
        <Avatar user={user} />
        <div>
          <div className="muted" style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase' }}>Tài khoản</div>
          <div style={{ marginTop: 6, fontWeight: 900 }}>{displayName}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>@{user.username}</div>
        </div>
      </Link>
      <div className="sidebar-balance" data-live-balance>
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
  );
}

export function TopbarAccount({ initialUser }: { initialUser: ShellAccountUser }) {
  const user = useLiveAccount(initialUser, true);
  const displayName = accountDisplayName(user);

  return (
    <Link className="topbar-user" href="/profile" data-live-balance>
      <Avatar user={user} small />
      <div>
        <span>{displayName}</span>
        <strong>{formatMoney(user.balance)} đ</strong>
      </div>
    </Link>
  );
}
