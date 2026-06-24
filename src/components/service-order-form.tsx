'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send, ShoppingCart } from 'lucide-react';
import { PlatformIcon } from '@/components/platform-icon';
import { getPlatformMeta, serviceShortName, serviceUnitLabel } from '@/lib/platforms';
import { formatMoney } from '@/lib/utils';
import type { ServicePriceRow } from '@/lib/services';

export function ServiceOrderForm({ service }: { service: ServicePriceRow }) {
  const router = useRouter();
  const [link, setLink] = useState('');
  const [quantity, setQuantity] = useState(service.min_qty || 100);
  const [comments, setComments] = useState('');
  const [buyerInfo, setBuyerInfo] = useState('');
  const [customValue, setCustomValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const total = service.source === 'smm'
    ? Math.ceil((Number(quantity || 0) / 1000) * Number(service.sale_price || 0))
    : Math.ceil(Number(service.sale_price || 0));
  const platform = getPlatformMeta(service);

  async function submit() {
    setLoading(true);
    setMessage('');
    const path = service.source === 'smm' ? '/api/orders/smm' : '/api/orders/automxh';
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: service.id,
        link,
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
          <span className="label">Liên kết cần chạy</span>
          <input className="input input-lg" value={link} onChange={(e) => setLink(e.target.value)} placeholder="Dán link bài viết, video, profile hoặc ID cần chạy" />
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
