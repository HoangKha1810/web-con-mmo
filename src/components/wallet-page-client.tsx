'use client';

import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { CheckCircle2, Copy, ExternalLink, Loader2, QrCode, RefreshCw, Wallet } from 'lucide-react';
import { ACCOUNT_BALANCE_EVENT } from '@/components/account-widgets';
import { formatMoney } from '@/lib/utils';

type WalletUser = {
  id: number;
  username: string;
  balance: number;
};

type DepositRow = {
  id: number;
  amount: number;
  method: string;
  content: string;
  note: string;
  status: string;
  admin_note?: string;
  external_ref?: string;
  created_at: string;
};

type SePayPayment = {
  order_id: string;
  sepay_order_id?: string;
  checkout_url: string;
  checkout_redirect_url?: string;
  fields?: Record<string, string>;
  ipn_url?: string;
};

function statusLabel(status: string) {
  const map: Record<string, string> = {
    pending: 'Đang chờ',
    approved: 'Đã cộng',
    rejected: 'Từ chối',
    failed: 'Lỗi',
  };
  return map[status] || status;
}

function primaryTransferCode(content: string) {
  return content.split('|').find((part) => part.trim().startsWith('PAY')) || content.split('|')[0] || content;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sepayAutoSubmitHtml(action: string, fields: Record<string, string>) {
  const inputs = Object.entries(fields)
    .map(([key, value]) => `<input type="hidden" name="${escapeHtml(key)}" value="${escapeHtml(value)}" />`)
    .join('');

  return `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <style>
      html,body{height:100%;margin:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a}
      .wrap{display:grid;min-height:100%;place-items:center;padding:24px;text-align:center}
      .box{max-width:360px}
      .loader{width:42px;height:42px;margin:0 auto 18px;border:4px solid #dbeafe;border-top-color:#2563eb;border-radius:50%;animation:spin 1s linear infinite}
      @keyframes spin{to{transform:rotate(360deg)}}
    </style>
  </head>
  <body>
    <div class="wrap"><div class="box"><div class="loader"></div><strong>Đang mở QR SePay...</strong></div></div>
    <form id="sepayForm" method="post" action="${escapeHtml(action)}">${inputs}</form>
    <script>document.getElementById('sepayForm').submit();</script>
  </body>
</html>`;
}

function postSepayToNewTab(action: string, fields: Record<string, string>) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = action;
  form.target = '_blank';
  form.rel = 'noreferrer';
  form.style.display = 'none';

  Object.entries(fields).forEach(([key, value]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = key;
    input.value = value;
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
  form.remove();
}

export function WalletPageClient({ user, initialDeposits }: { user: WalletUser; initialDeposits: DepositRow[] }) {
  const [amount, setAmount] = useState('100000');
  const [note, setNote] = useState('');
  const [deposits, setDeposits] = useState(initialDeposits);
  const [balance, setBalance] = useState(Number(user.balance || 0));
  const [payment, setPayment] = useState<SePayPayment | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const pendingDeposit = useMemo(() => deposits.find((deposit) => deposit.status === 'pending') || null, [deposits]);

  function publishBalance(nextBalance: number) {
    window.dispatchEvent(new CustomEvent(ACCOUNT_BALANCE_EVENT, {
      detail: {
        balance: nextBalance,
        user: { id: user.id, username: user.username, balance: nextBalance },
      },
    }));
  }

  async function loadDeposits(silent = false) {
    if (!silent) setRefreshing(true);
    try {
      const [response, profileResponse] = await Promise.all([
        fetch('/api/deposits', { cache: 'no-store' }),
        fetch('/api/profile', { cache: 'no-store' }),
      ]);
      const payload = await response.json().catch(() => ({}));
      const profile = await profileResponse.json().catch(() => ({}));
      if (response.ok && payload.success && Array.isArray(payload.data)) {
        setDeposits(payload.data);
      }
      if (profileResponse.ok && profile.success && profile.user) {
        const nextBalance = Number(profile.user.balance || 0);
        setBalance(nextBalance);
        publishBalance(nextBalance);
      }
    } finally {
      if (!silent) setRefreshing(false);
    }
  }

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && deposits.some((deposit) => deposit.status === 'pending')) {
        void loadDeposits(true);
      }
    }, 5000);

    return () => window.clearInterval(timer);
  }, [deposits]);

  async function createPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    setPayment(null);

    const numericAmount = Math.trunc(Number(amount || 0));
    if (!Number.isFinite(numericAmount) || numericAmount < 10000) {
      setError('Số tiền nạp tối thiểu là 10.000đ.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/deposits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: numericAmount, note }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không tạo được QR thanh toán');
      }

      setPayment(payload.payment);
      setMessage(payload.message || 'Đã tạo QR thanh toán SePay.');
      await loadDeposits(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tạo được QR thanh toán');
    } finally {
      setLoading(false);
    }
  }

  async function copyText(value: string) {
    await navigator.clipboard.writeText(value);
    setMessage('Đã copy nội dung chuyển khoản.');
  }

  return (
    <>
      <div className="hero wallet-hero reveal">
        <div className="badge green">Wallet</div>
        <h1>Nạp tiền tài khoản</h1>
        <p className="muted">Tạo QR SePay, thanh toán và hệ thống tự cộng số dư sau khi nhận xác nhận từ cổng thanh toán.</p>
      </div>

      <div className="wallet-grid">
        <form className="form-panel wallet-create reveal" onSubmit={createPayment}>
          <div className="wallet-panel-title">
            <Wallet size={22} />
            <div>
              <h2>Tạo QR thanh toán</h2>
              <p className="muted">Số tiền nạp sẽ cộng vào ví web con của bạn và đồng thời nạp vào tài khoản nguồn API của admin web con.</p>
            </div>
          </div>

          <label>
            <span className="label">Số tiền</span>
            <input className="input input-lg" value={amount} onChange={(event) => setAmount(event.target.value)} type="number" min="10000" placeholder="100000" required />
          </label>

          <div className="quick-amounts" aria-label="Chọn nhanh số tiền">
            {[50000, 100000, 200000, 500000, 1000000].map((item) => (
              <button type="button" key={item} onClick={() => setAmount(String(item))}>
                {formatMoney(item)} đ
              </button>
            ))}
          </div>

          <label style={{ display: 'block', marginTop: 14 }}>
            <span className="label">Ghi chú nội bộ</span>
            <input className="input input-lg" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Không bắt buộc" />
          </label>

          <button className="btn btn-lg" disabled={loading} style={{ marginTop: 16, width: '100%' }}>
            {loading ? <Loader2 className="spin" size={18} /> : <QrCode size={18} />}
            Tạo QR thanh toán
          </button>

          {error ? <div className="notice danger">{error}</div> : null}
          {message ? <div className="notice success">{message}</div> : null}
        </form>

        <section className="card payment-panel reveal">
          <div className="wallet-panel-title">
            <QrCode size={22} />
            <div>
              <h2>QR SePay</h2>
              <p className="muted">Giữ nguyên nội dung thanh toán để hệ thống tự đối soát.</p>
            </div>
          </div>

          {payment ? (
            <div className="sepay-box">
              <div className="payment-meta">
                <span>Nội dung</span>
                <button type="button" onClick={() => copyText(primaryTransferCode(payment.fields?.order_invoice_number || `${payment.sepay_order_id || ''}|${payment.order_id}`))}>
                  <strong>{primaryTransferCode(payment.fields?.order_invoice_number || `${payment.sepay_order_id || ''}|${payment.order_id}`)}</strong>
                  <Copy size={15} />
                </button>
              </div>
              {payment.checkout_redirect_url ? (
                <iframe className="sepay-frame" src={payment.checkout_redirect_url} title="SePay QR thanh toán" />
              ) : (
                <iframe className="sepay-frame" srcDoc={sepayAutoSubmitHtml(payment.checkout_url, payment.fields || {})} title="SePay QR thanh toán" />
              )}
              <button
                className="btn secondary"
                type="button"
                onClick={() => {
                  if (payment.checkout_redirect_url) {
                    window.open(payment.checkout_redirect_url, '_blank', 'noopener,noreferrer');
                    return;
                  }
                  postSepayToNewTab(payment.checkout_url, payment.fields || {});
                }}
              >
                <ExternalLink size={16} />
                Mở QR ở tab mới
              </button>
            </div>
          ) : (
            <div className="empty-payment">
              <QrCode size={44} />
              <h3>QR sẽ hiện ở đây</h3>
              <p className="muted">Nhập số tiền rồi bấm tạo QR, không cần rời khỏi trang nạp tiền.</p>
            </div>
          )}
        </section>
      </div>

      <section className="card wallet-summary reveal">
        <div>
          <span className="label">Số dư ví web con</span>
          <strong className="money">{formatMoney(balance)} đ</strong>
        </div>
        {pendingDeposit ? (
          <div className="pending-hint">
            <CheckCircle2 size={18} />
            Đang chờ xác nhận giao dịch #{pendingDeposit.id}
          </div>
        ) : null}
        <button className="btn secondary" type="button" onClick={() => loadDeposits()} disabled={refreshing}>
          <RefreshCw size={16} className={refreshing ? 'spin' : ''} />
          Làm mới
        </button>
      </section>

      <section className="deposit-list reveal">
        {deposits.map((deposit) => (
          <article className="deposit-item" key={deposit.id}>
            <div>
              <span className="label">Mã nạp</span>
              <strong>#{deposit.id}</strong>
              <p>{primaryTransferCode(deposit.content)}</p>
            </div>
            <div>
              <span className="label">Số tiền</span>
              <strong className="money">{formatMoney(deposit.amount)} đ</strong>
            </div>
            <div>
              <span className="label">Trạng thái</span>
              <span className={`badge status-${deposit.status}`}>{statusLabel(deposit.status)}</span>
            </div>
            <div>
              <span className="label">Ngày tạo</span>
              <time>{deposit.created_at}</time>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}
