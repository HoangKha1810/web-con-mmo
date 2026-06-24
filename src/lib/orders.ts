import 'server-only';

import { db, runTx } from '@/lib/db';
import { createAutoMxhOrder, createSmmOrder, getAutoMxhStatus, getSmmStatus } from '@/lib/upstream';
import { getServiceById, quoteService, quoteSourceServiceCost, type ServicePriceRow } from '@/lib/services';
import { nowIso, toNumber } from '@/lib/utils';

type UserLike = {
  id: number;
  username: string;
  balance: number;
};

export function listUserOrders(userId: number) {
  return JSON.parse(JSON.stringify(db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 100').all(userId)));
}

function decorateOrder(row: any) {
  const amount = Number(row.amount || 0);
  const storedSourceAmount = Number(row.source_amount || 0);
  const basePrice = Number(row.current_base_price || row.base_price || 0);
  const fallbackSourceAmount = row.source === 'smm'
    ? Math.ceil((Number(row.quantity || 0) / 1000) * basePrice)
    : Math.ceil(basePrice);
  const sourceAmount = storedSourceAmount > 0 ? storedSourceAmount : fallbackSourceAmount;
  const profitAmount = Number(row.profit_amount || 0) || amount - sourceAmount;

  return {
    ...row,
    amount,
    source_amount: sourceAmount,
    profit_amount: profitAmount,
  };
}

export function listAllOrders() {
  const rows = db.prepare(`
    SELECT o.*, u.username, u.email, sp.base_price AS current_base_price, sp.sale_price AS current_sale_price
    FROM orders o
    JOIN users u ON u.id = o.user_id
    LEFT JOIN service_prices sp
      ON sp.source = o.source
      AND sp.service_key = o.service_key
      AND sp.provider_id = o.provider_id
    ORDER BY o.id DESC
    LIMIT 300
  `).all();
  return JSON.parse(JSON.stringify(rows.map(decorateOrder)));
}

export function getOrderFinancialSummary() {
  const rows = (db.prepare(`
    SELECT o.*, sp.base_price AS current_base_price
    FROM orders o
    LEFT JOIN service_prices sp
      ON sp.source = o.source
      AND sp.service_key = o.service_key
      AND sp.provider_id = o.provider_id
  `).all() as any[]).map(decorateOrder);
  const billableOrders = rows.filter((row) => String(row.status || '') !== 'failed');
  const totalSaleAmount = billableOrders.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const totalSourceAmount = billableOrders.reduce((sum, row) => sum + Number(row.source_amount || 0), 0);

  return JSON.parse(JSON.stringify({
    totalOrders: rows.length,
    billableOrders: billableOrders.length,
    failedOrders: rows.length - billableOrders.length,
    totalSaleAmount,
    totalSourceAmount,
    totalProfitAmount: totalSaleAmount - totalSourceAmount,
  }));
}

function insertLedger(input: {
  userId: number;
  type: string;
  amount: number;
  before: number;
  after: number;
  refType: string;
  refId: number;
  note: string;
}) {
  db.prepare(`
    INSERT INTO ledger (user_id, type, amount, balance_before, balance_after, ref_type, ref_id, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(input.userId, input.type, input.amount, input.before, input.after, input.refType, input.refId, input.note, nowIso());
}

function extractUpstreamOrder(payload: any) {
  return String(payload?.order || payload?.data?.order || payload?.data?.api_order_id || payload?.provider_order || '');
}

export async function createOrder(user: UserLike, input: {
  serviceId: number;
  link: string;
  quantity?: number;
  comments?: string;
  buyerInfo?: string;
  customValue?: string;
}) {
  const service = getServiceById(input.serviceId);
  if (!service || !service.enabled) throw new Error('Dịch vụ không khả dụng');
  const link = String(input.link || '').trim();
  if (!link) throw new Error('Thiếu link cần chạy dịch vụ');

  const quantity = service.source === 'smm'
    ? Math.max(1, Math.trunc(toNumber(input.quantity, 0)))
    : Math.max(1, Math.trunc(Number(service.min_qty || 1)));
  const amount = quoteService(service as ServicePriceRow, quantity);
  const sourceAmount = quoteSourceServiceCost(service as ServicePriceRow, quantity);
  const profitAmount = amount - sourceAmount;
  const latestUser = db.prepare('SELECT id, username, balance FROM users WHERE id = ? LIMIT 1').get(user.id) as UserLike | undefined;
  if (!latestUser) throw new Error('Không tìm thấy tài khoản');
  if (Number(latestUser.balance || 0) < amount) throw new Error('Số dư tài khoản không đủ');

  const now = nowIso();
  let orderId = 0;
  runTx(() => {
    const before = Number(latestUser.balance || 0);
    const after = before - amount;
    db.prepare('UPDATE users SET balance = ?, updated_at = ? WHERE id = ?').run(after, now, user.id);
    const result = db.prepare(`
      INSERT INTO orders (
        user_id, source, service_key, provider_id, service_name, link, quantity,
        comments, buyer_info, custom_value, amount, source_amount, profit_amount, status, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'processing', ?, ?)
    `).run(
      user.id,
      service.source,
      service.service_key,
      service.provider_id,
      service.display_name,
      link,
      quantity,
      input.comments || '',
      input.buyerInfo || '',
      input.customValue || '',
      amount,
      sourceAmount,
      profitAmount,
      now,
      now
    );
    orderId = Number(result.lastInsertRowid);
    insertLedger({
      userId: user.id,
      type: 'order_hold',
      amount: -amount,
      before,
      after,
      refType: 'order',
      refId: orderId,
      note: `Đặt đơn ${service.source.toUpperCase()} #${orderId}`,
    });
  });

  try {
    const payload = service.source === 'smm'
      ? await createSmmOrder({
          service: Number(service.service_key),
          provider_id: service.provider_id || undefined,
          link,
          quantity,
          comments: input.comments,
        })
      : await createAutoMxhOrder({
          service: Number(service.service_key),
          product_id: service.provider_id || undefined,
          link,
          buyer_info: input.buyerInfo,
          custom_value: input.customValue,
        });

    const upstreamOrder = extractUpstreamOrder(payload);
    db.prepare(`
      UPDATE orders
      SET upstream_order = ?, upstream_status = ?, status = ?, raw_response = ?, updated_at = ?
      WHERE id = ?
    `).run(upstreamOrder, 'processing', 'processing', JSON.stringify(payload), nowIso(), orderId);
    return { orderId, amount, sourceAmount, profitAmount, upstreamOrder, payload };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upstream lỗi';
    runTx(() => {
      const current = db.prepare('SELECT balance FROM users WHERE id = ? LIMIT 1').get(user.id) as { balance: number };
      const before = Number(current.balance || 0);
      const after = before + amount;
      db.prepare('UPDATE users SET balance = ?, updated_at = ? WHERE id = ?').run(after, nowIso(), user.id);
      db.prepare('UPDATE orders SET status = ?, error_message = ?, updated_at = ? WHERE id = ?').run('failed', message, nowIso(), orderId);
      insertLedger({
        userId: user.id,
        type: 'order_refund',
        amount,
        before,
        after,
        refType: 'order',
        refId: orderId,
        note: `Hoàn tiền do đơn không xử lý được: ${message}`,
      });
    });
    throw new Error(message);
  }
}

export async function refreshOrderStatus(orderId: number, userId?: number) {
  const row = db.prepare('SELECT * FROM orders WHERE id = ? LIMIT 1').get(orderId) as any;
  if (!row) throw new Error('Không tìm thấy đơn');
  if (userId && Number(row.user_id) !== userId) throw new Error('Bạn không có quyền xem đơn này');
  if (!row.upstream_order) return row;

  const payload = row.source === 'smm'
    ? await getSmmStatus(String(row.upstream_order))
    : await getAutoMxhStatus(String(row.upstream_order));
  const status = String(payload?.data?.status || payload?.data?.provider_status?.status || payload?.status || row.status || '').toLowerCase();
  const normalized = status.includes('complete') || status.includes('success')
    ? 'completed'
    : status.includes('cancel') || status.includes('fail') || status.includes('refund')
      ? 'failed'
      : 'processing';
  db.prepare('UPDATE orders SET upstream_status = ?, status = ?, raw_response = ?, updated_at = ? WHERE id = ?').run(
    status || normalized,
    normalized,
    JSON.stringify(payload),
    nowIso(),
    orderId
  );
  return db.prepare('SELECT * FROM orders WHERE id = ? LIMIT 1').get(orderId);
}
