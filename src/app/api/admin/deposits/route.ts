import { db, runTx } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { fail, ok, readBody } from '@/lib/api-response';
import { nowIso } from '@/lib/utils';
import { topUpSourceBalance } from '@/lib/upstream';

function redirectToDeposits(req: Request) {
  return Response.redirect(new URL('/admin/deposits', req.url), 303);
}

export async function GET() {
  try {
    await requireAdmin();
    const data = db.prepare(`
      SELECT d.*, u.username, u.email
      FROM deposits d
      JOIN users u ON u.id = d.user_id
      ORDER BY d.id DESC
      LIMIT 300
    `).all();
    return ok({ data });
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Không có quyền', 403);
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = await readBody(req);
    const id = Number(body.id || 0);
    const action = String(body.action || '').trim();
    const adminNote = String(body.admin_note || '').trim();
    const deposit = db.prepare('SELECT * FROM deposits WHERE id = ? LIMIT 1').get(id) as { id: number; user_id: number; amount: number; status: string; external_ref?: string } | undefined;
    if (!deposit) return fail('Không tìm thấy lệnh nạp', 404);
    if (deposit.status !== 'pending') return fail('Lệnh nạp đã xử lý');

    const now = nowIso();
    if (action === 'approve') {
      const sourceRef = String(deposit.external_ref || '').trim() || `hethongsub-deposit-${deposit.id}`;
      const sourceTopup = await topUpSourceBalance({
        amount: Number(deposit.amount || 0),
        externalRef: sourceRef,
        note: `Admin hethongsub duyệt nạp #${deposit.id}${adminNote ? ` - ${adminNote}` : ''}`,
      });
      const sourceTransactionId = String(sourceTopup?.transaction_id || sourceTopup?.data?.transaction_id || '');
      const savedAdminNote = [
        adminNote,
        sourceTransactionId ? `source_tx=${sourceTransactionId}` : '',
      ].filter(Boolean).join(' | ');

      runTx(() => {
        const user = db.prepare('SELECT balance FROM users WHERE id = ? LIMIT 1').get(deposit.user_id) as { balance: number };
        const before = Number(user.balance || 0);
        const after = before + Number(deposit.amount || 0);
        db.prepare('UPDATE users SET balance = ?, updated_at = ? WHERE id = ?').run(after, now, deposit.user_id);
        db.prepare('UPDATE deposits SET status = ?, admin_note = ?, external_ref = ?, updated_at = ? WHERE id = ?').run('approved', savedAdminNote, sourceRef, now, id);
        db.prepare(`
          INSERT INTO ledger (user_id, type, amount, balance_before, balance_after, ref_type, ref_id, note, created_at)
          VALUES (?, 'deposit', ?, ?, ?, 'deposit', ?, ?, ?)
        `).run(deposit.user_id, deposit.amount, before, after, id, `Admin duyệt nạp tiền web con, nguồn API đã cộng${sourceTransactionId ? ` #${sourceTransactionId}` : ''}`, now);
      });
      if (req.headers.get('content-type')?.includes('application/x-www-form-urlencoded') || req.headers.get('content-type')?.includes('multipart/form-data')) {
        return redirectToDeposits(req);
      }
      return ok({ message: 'Đã duyệt nạp tiền', source: sourceTopup });
    }

    if (action === 'reject') {
      db.prepare('UPDATE deposits SET status = ?, admin_note = ?, updated_at = ? WHERE id = ?').run('rejected', adminNote, now, id);
      if (req.headers.get('content-type')?.includes('application/x-www-form-urlencoded') || req.headers.get('content-type')?.includes('multipart/form-data')) {
        return redirectToDeposits(req);
      }
      return ok({ message: 'Đã từ chối nạp tiền' });
    }

    return fail('Action không hợp lệ');
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Không thể xử lý nạp tiền', 403);
  }
}
