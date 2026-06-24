import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { fail, isFormRequest, ok, readBody } from '@/lib/api-response';
import { buildSePayReferenceContent } from '@/lib/sepay-codes';
import { syncPendingDepositsFromUpstream } from '@/lib/deposit-processing';
import { createSourceDepositCheckout } from '@/lib/upstream';
import { nowIso, toNumber } from '@/lib/utils';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sepayAutoSubmitPage(action: string, fields: Record<string, string>) {
  const inputs = Object.entries(fields)
    .map(([key, value]) => `<input type="hidden" name="${escapeHtml(key)}" value="${escapeHtml(value)}" />`)
    .join('');

  return new Response(`<!doctype html>
<html lang="vi">
  <head><meta charset="utf-8"><title>Đang mở QR SePay</title></head>
  <body>
    <form id="sepayForm" method="post" action="${escapeHtml(action)}">${inputs}</form>
    <script>document.getElementById('sepayForm').submit();</script>
  </body>
</html>`, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

export async function GET() {
  try {
    const user = await requireUser();
    await syncPendingDepositsFromUpstream({ userId: user.id, limit: 10 }).catch(() => null);
    const data = db.prepare('SELECT * FROM deposits WHERE user_id = ? ORDER BY id DESC LIMIT 100').all(user.id);
    return ok({ data });
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Không thể tải nạp tiền', 401);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await readBody(req);
    const amount = Math.max(0, Math.trunc(toNumber(body.amount, 0)));
    const method = 'sepay';
    const note = String(body.note || '').trim();

    if (amount < 10000) {
      return fail('Số tiền nạp tối thiểu 10.000đ');
    }

    const now = nowIso();
    const content = `HSSSEP${user.id}T${Date.now()}`;
    const result = db.prepare(`
      INSERT INTO deposits (user_id, amount, method, content, note, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
    `).run(user.id, amount, method, content, note, now, now);
    const depositId = Number(result.lastInsertRowid);

    const origin = new URL(req.url).origin;
    const upstreamCheckout = await createSourceDepositCheckout({
      amount,
      externalRef: content,
      note: `Nap tien hethongsub user=${user.username} deposit=#${depositId}${note ? ` note=${note}` : ''}`,
      callbackOrigin: origin,
      successUrl: `${origin}/wallet?payment=success`,
      errorUrl: `${origin}/wallet?payment=error`,
      cancelUrl: `${origin}/wallet?payment=cancel`,
    });
    const payment = upstreamCheckout?.payment || {};
    const sourceOrderId = String(upstreamCheckout?.source_order_id || upstreamCheckout?.data?.source_order_id || payment.order_id || '');
    const sepayOrderId = String(payment.sepay_order_id || '');

    if (!upstreamCheckout?.success || !payment.checkout_url || !payment.fields) {
      const message = String(upstreamCheckout?.message || 'Web chính không trả về QR SePay hợp lệ');
      db.prepare('UPDATE deposits SET status = ?, admin_note = ?, updated_at = ? WHERE id = ?')
        .run('failed', message, nowIso(), depositId);
      return fail(message);
    }

    const storedContent = buildSePayReferenceContent([sepayOrderId, sourceOrderId, content]);
    db.prepare('UPDATE deposits SET content = ?, external_ref = ?, updated_at = ? WHERE id = ?')
      .run(storedContent, content, nowIso(), depositId);

    if (isFormRequest(req)) {
      return sepayAutoSubmitPage(payment.checkout_url, payment.fields);
    }

    return ok({
      message: 'Đã tạo QR thanh toán SePay. Sau khi thanh toán thành công, hệ thống sẽ tự cộng số dư.',
      method,
      deposit: {
        id: depositId,
        amount,
        method,
        content: storedContent,
        status: 'pending',
      },
      payment: {
        order_id: content,
        source_order_id: sourceOrderId,
        sepay_order_id: sepayOrderId,
        checkout_url: payment.checkout_url,
        checkout_redirect_url: payment.checkout_redirect_url,
        fields: payment.fields,
        ipn_url: payment.ipn_url,
      },
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Không thể tạo lệnh nạp', 401);
  }
}
