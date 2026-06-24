import { db, runTx } from '@/lib/db';
import { fail, ok, readBody } from '@/lib/api-response';
import { nowIso, toNumber } from '@/lib/utils';
import { topUpSourceBalance } from '@/lib/upstream';

function checkAdminSecret(req: Request, body: Record<string, unknown>) {
  const secret = process.env.SESSION_SECRET || '';
  const passed = req.headers.get('x-admin-secret') || String(body.secret || '');
  return Boolean(secret && passed === secret);
}

export async function GET() {
  return ok({
    docs: {
      endpoint: '/api/external/deposits',
      method: 'POST',
      auth: 'x-admin-secret: SESSION_SECRET',
      body: {
        username: 'username cần cộng tiền',
        amount: 100000,
        external_ref: 'bank-transaction-id',
        note: 'Nạp tự động từ bank webhook',
      },
      description: 'API này dùng cho webhook ngân hàng hoặc tool nội bộ. Khi cộng tiền vào ví user web con, hệ thống cũng nạp đúng số tiền đó vào tài khoản nguồn đang sở hữu UPSTREAM_API_KEY trên web chính.',
    },
  });
}

export async function POST(req: Request) {
  const body = await readBody(req);
  if (!checkAdminSecret(req, body)) return fail('Secret không hợp lệ', 401);

  const username = String(body.username || '').trim().toLowerCase();
  const amount = Math.max(0, Math.trunc(toNumber(body.amount, 0)));
  const externalRef = String(body.external_ref || '').trim();
  const note = String(body.note || '').trim();
  if (!username || amount <= 0) return fail('Thiếu username hoặc amount');

  const user = db.prepare('SELECT id, balance FROM users WHERE username = ? LIMIT 1').get(username) as { id: number; balance: number } | undefined;
  if (!user) return fail('Không tìm thấy user', 404);

  if (externalRef) {
    const existing = db.prepare(`
      SELECT id, amount
      FROM deposits
      WHERE user_id = ? AND external_ref = ? AND status = 'approved'
      ORDER BY id DESC
      LIMIT 1
    `).get(user.id, externalRef) as { id: number; amount: number } | undefined;

    if (existing) {
      return ok({
        message: 'Giao dịch đã được xử lý trước đó',
        username,
        amount: existing.amount,
        deposit_id: existing.id,
        already_processed: true,
      });
    }
  }

  const now = nowIso();
  const sourceRef = externalRef || `hethongsub-api-${username}-${Date.now()}`;
  const sourceTopup = await topUpSourceBalance({
    amount,
    externalRef: sourceRef,
    note: note || `API nạp tiền web con cho ${username}`,
  });
  const sourceTransactionId = String(sourceTopup?.transaction_id || sourceTopup?.data?.transaction_id || '');
  let depositId = 0;

  runTx(() => {
    const before = Number(user.balance || 0);
    const after = before + amount;
    const deposit = db.prepare(`
      INSERT INTO deposits (user_id, amount, method, content, note, status, admin_note, external_ref, created_at, updated_at)
      VALUES (?, ?, 'api', ?, ?, 'approved', ?, ?, ?, ?)
    `).run(
      user.id,
      amount,
      sourceRef,
      note,
      sourceTransactionId ? `Auto API approved | source_tx=${sourceTransactionId}` : 'Auto API approved',
      sourceRef,
      now,
      now
    );
    depositId = Number(deposit.lastInsertRowid);
    db.prepare('UPDATE users SET balance = ?, updated_at = ? WHERE id = ?').run(after, now, user.id);
    db.prepare(`
      INSERT INTO ledger (user_id, type, amount, balance_before, balance_after, ref_type, ref_id, note, created_at)
      VALUES (?, 'deposit_api', ?, ?, ?, 'deposit', ?, ?, ?)
    `).run(user.id, amount, before, after, depositId, note || `API nạp tiền web con, nguồn API đã cộng${sourceTransactionId ? ` #${sourceTransactionId}` : ''}`, now);
  });

  return ok({ message: 'Đã cộng tiền', username, amount, deposit_id: depositId, source: sourceTopup });
}
