'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, X } from 'lucide-react';

type AuthMode = 'login' | 'register';

function friendlyMessage(message: string, mode: AuthMode) {
  const raw = message.trim();
  if (raw) return raw;
  return mode === 'login' ? 'Không thể đăng nhập. Vui lòng kiểm tra lại thông tin.' : 'Không thể tạo tài khoản. Vui lòng thử lại.';
}

function redirectPath(role?: string) {
  if (role === 'admin') return '/admin';
  if (role === 'owner') return '/admin/funds';
  return '/dashboard';
}

export function AuthForm({ mode }: { mode: AuthMode }) {
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ tone: 'success' | 'danger'; title: string; message: string } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setLoading(true);
    setToast(null);

    try {
      const response = await fetch(mode === 'login' ? '/api/auth/login' : '/api/auth/register', {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: formData,
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload.success) {
        setToast({
          tone: 'danger',
          title: mode === 'login' ? 'Đăng nhập thất bại' : 'Đăng ký chưa thành công',
          message: friendlyMessage(String(payload.message || ''), mode),
        });
        return;
      }

      setToast({
        tone: 'success',
        title: mode === 'login' ? 'Đăng nhập thành công' : 'Tạo tài khoản thành công',
        message: 'Đang chuyển bạn vào dashboard...',
      });
      window.location.href = redirectPath(payload.user?.role);
    } catch {
      setToast({
        tone: 'danger',
        title: 'Không kết nối được máy chủ',
        message: 'Vui lòng kiểm tra mạng hoặc thử lại sau ít phút.',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {toast ? (
        <div className={`auth-toast ${toast.tone}`} role="alert">
          <div className="auth-toast-icon">
            {toast.tone === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          </div>
          <div>
            <strong>{toast.title}</strong>
            <p>{toast.message}</p>
          </div>
          <button type="button" onClick={() => setToast(null)} aria-label="Đóng thông báo">
            <X size={16} />
          </button>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="grid auth-form">
        {mode === 'register' ? (
          <label>
            <span className="label">Họ tên</span>
            <input className="input input-xl" name="full_name" placeholder="Tên hiển thị của bạn" />
          </label>
        ) : null}

        {mode === 'login' ? (
          <label>
            <span className="label">Username hoặc email</span>
            <input className="input input-xl" name="login" placeholder="Nhập username hoặc email" autoComplete="username" required />
          </label>
        ) : (
          <>
            <label>
              <span className="label">Username</span>
              <input className="input input-xl" name="username" placeholder="Ví dụ: khachhang01" autoComplete="username" required />
            </label>
            <label>
              <span className="label">Email</span>
              <input className="input input-xl" name="email" type="email" placeholder="email@example.com" autoComplete="email" required />
            </label>
          </>
        )}

        <label>
          <span className="label">Mật khẩu</span>
          <input
            className="input input-xl"
            name="password"
            type="password"
            placeholder={mode === 'login' ? 'Nhập mật khẩu' : 'Tối thiểu 6 ký tự'}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
          />
        </label>

        <button className="btn btn-xl" type="submit" disabled={loading}>
          {loading ? <Loader2 className="spin" size={18} /> : null}
          {mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
          {!loading ? <ArrowRight size={18} /> : null}
        </button>
      </form>
    </>
  );
}
