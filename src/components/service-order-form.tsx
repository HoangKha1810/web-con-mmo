'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardPaste, Loader2, Send, ShoppingCart, Sparkles } from 'lucide-react';
import { PlatformIcon } from '@/components/platform-icon';
import { getPlatformMeta, serviceShortName, serviceUnitLabel } from '@/lib/platforms';
import { formatMoney } from '@/lib/utils';
import type { ServicePriceRow } from '@/lib/services';

type LookupPayload = {
  success?: boolean;
  id?: string;
  uid?: string;
  platform?: string;
  message?: string;
};

function looksLikeFacebookUrl(value: string) {
  return /facebook\.com|fb\.com|fb\.watch/i.test(value);
}

export function ServiceOrderForm({ service }: { service: ServicePriceRow }) {
  const router = useRouter();
  const [link, setLink] = useState('');
  const [quantity, setQuantity] = useState(service.min_qty || 100);
  const [comments, setComments] = useState('');
  const [buyerInfo, setBuyerInfo] = useState('');
  const [customValue, setCustomValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupMessage, setLookupMessage] = useState('');
  const [resolvedId, setResolvedId] = useState('');

  const total = service.source === 'smm'
    ? Math.ceil((Number(quantity || 0) / 1000) * Number(service.sale_price || 0))
    : Math.ceil(Number(service.sale_price || 0));
  const platform = getPlatformMeta(service);
  const targetLabel = useMemo(() => service.source === 'smm' ? 'Liên kết hoặc ID cần chạy' : 'Link hoặc ID tài khoản', [service.source]);

  useEffect(() => {
    setLink('');
    setQuantity(service.min_qty || 100);
    setComments('');
    setBuyerInfo('');
    setCustomValue('');
    setMessage('');
    setLookupMessage('');
    setResolvedId('');
  }, [service.id, service.min_qty]);

  const resolveObjectId = useCallback(async (source = link, options?: { silent?: boolean }) => {
    const input = String(source || '').trim();
    if (!input) {
      if (!options?.silent) {
        setLookupMessage('Vui lòng nhập link hoặc ID trước khi lấy UID/ID.');
      }
      return '';
    }

    setLookupLoading(true);
    if (!options?.silent) {
      setLookupMessage('');
      setMessage('');
    }

    try {
      const res = await fetch('/api/social/get-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: input,
          platform: platform.label,
          service_id: service.id,
          source: service.source,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as LookupPayload;
      const id = String(payload.uid || payload.id || '').trim();

      if (!res.ok || !payload.success || !id) {
        if (!options?.silent) {
          setLookupMessage(payload.message || 'Không lấy được UID/ID từ liên kết này.');
        }
        return '';
      }

      setLink(id);
      setResolvedId(id);
      setLookupMessage(`Đã lấy ${payload.platform || platform.label}: ${id}`);
      return id;
    } catch {
      if (!options?.silent) {
        setLookupMessage('Không thể lấy UID/ID lúc này, vui lòng thử lại hoặc nhập ID trực tiếp.');
      }
      return '';
    } finally {
      setLookupLoading(false);
    }
  }, [link, platform.label, service.id, service.source]);

  useEffect(() => {
    const value = link.trim();
    if (!value || !looksLikeFacebookUrl(value)) return;

    const timer = window.setTimeout(() => {
      void resolveObjectId(value, { silent: true });
    }, 800);

    return () => window.clearTimeout(timer);
  }, [link, resolveObjectId]);

  async function pasteLink() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setLink(text);
        setResolvedId('');
        setLookupMessage('');
      }
    } catch {
      setLookupMessage('Trình duyệt không cho đọc clipboard, bạn dán thủ công giúp mình.');
    }
  }

  async function submit() {
    setLoading(true);
    setMessage('');
    setLookupMessage('');
    let targetLink = link.trim();
    if (looksLikeFacebookUrl(targetLink)) {
      const id = await resolveObjectId(targetLink, { silent: true });
      if (id) {
        targetLink = id;
      } else {
        setLoading(false);
        setMessage('Chưa lấy được UID Facebook từ link này. Bấm Lấy UID/ID hoặc nhập ID trực tiếp trước khi tạo đơn.');
        return;
      }
    }

    const path = service.source === 'smm' ? '/api/orders/smm' : '/api/orders/automxh';
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: service.id,
        link: targetLink,
        quantity,
        comments,
        buyer_info: buyerInfo,
        custom_value: customValue,
      }),
    });
    const payload = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok || payload.success === false) {
      setMessage(payload.message || 'Không thể tạo đơn');
      return;
    }
    router.push('/orders');
  }

  return (
    <div className="form-panel order-form">
      <div className="order-form-title">
        <PlatformIcon meta={platform} />
        <div>
          <div className="badge">{service.source === 'smm' ? 'SMM' : 'Auto MXH'}</div>
          <h3>{serviceShortName(service)}</h3>
          <p className="muted">{platform.label} · {service.category || 'Dịch vụ đang bán'}</p>
        </div>
      </div>

      <div className="price-strip">
        <span>Đơn giá</span>
        <strong>{formatMoney(service.sale_price)} đ</strong>
        <small>{serviceUnitLabel(service)}</small>
      </div>

      <div className="grid" style={{ marginTop: 18 }}>
        <label>
          <span className="label">{targetLabel}</span>
          <div className="target-input-wrap">
            <input
              className="input input-lg"
              value={link}
              onChange={(e) => {
                setLink(e.target.value);
                setResolvedId('');
                setLookupMessage('');
              }}
              placeholder="Dán link bài viết, video, profile hoặc nhập ID cần chạy"
            />
            <div className="target-actions">
              <button className="mini-action" type="button" onClick={pasteLink}>
                <ClipboardPaste size={14} />
                Dán
              </button>
              <button className="mini-action green" type="button" onClick={() => void resolveObjectId()} disabled={lookupLoading}>
                {lookupLoading ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
                Lấy UID/ID
              </button>
            </div>
          </div>
          <span className="field-hint">Dán link như web chính, bấm lấy UID/ID nếu dịch vụ yêu cầu ID. Facebook sẽ tự dò khi bạn dán link công khai.</span>
          {lookupMessage ? <span className={`lookup-note ${resolvedId ? 'success' : 'warning'}`}>{lookupMessage}</span> : null}
        </label>
        {service.source === 'smm' ? (
          <>
            <label>
              <span className="label">Số lượng</span>
              <input className="input input-lg" type="number" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} min={service.min_qty || 1} max={service.max_qty || undefined} />
              <span className="field-hint">Tối thiểu {formatMoney(service.min_qty || 1)}{service.max_qty ? ` · tối đa ${formatMoney(service.max_qty)}` : ''}</span>
            </label>
            <label>
              <span className="label">Comments nếu dịch vụ cần</span>
              <textarea className="textarea" value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Mỗi dòng một comment nếu gói yêu cầu nội dung bình luận" />
            </label>
          </>
        ) : (
          <>
            <label>
              <span className="label">Thông tin liên hệ</span>
              <input className="input input-lg" value={buyerInfo} onChange={(e) => setBuyerInfo(e.target.value)} placeholder="Zalo, Telegram hoặc thông tin liên hệ" />
            </label>
            <label>
              <span className="label">Thông tin xử lý</span>
              <textarea className="textarea" value={customValue} onChange={(e) => setCustomValue(e.target.value)} placeholder="Username, ID tài khoản, ghi chú hoặc yêu cầu xử lý" />
            </label>
          </>
        )}
      </div>

      <div className="checkout-total">
        <div>
          <span>Tạm tính</span>
          <strong>{formatMoney(total)} đ</strong>
        </div>
        <ShoppingCart size={24} />
      </div>

      {message ? <p style={{ color: 'var(--danger)', fontWeight: 800 }}>{message}</p> : null}
      <button className="btn btn-lg" type="button" onClick={submit} disabled={loading} style={{ width: '100%', marginTop: 16 }}>
        <Send size={17} />
        {loading ? 'Đang gửi đơn...' : 'Tạo đơn ngay'}
      </button>
    </div>
  );
}
