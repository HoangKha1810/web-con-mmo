import { db, runTx } from '@/lib/db';
import { requireFundManager } from '@/lib/auth';
import { fail, isFormRequest, ok, readBody, redirectResponse } from '@/lib/api-response';
import { nowIso, toNumber } from '@/lib/utils';

type FundStats = {
  total_approved: number;
  total_withdrawn: number;
};

function redirectToFunds(req: Request, query = '') {
  return redirectResponse(req, `/admin/funds${query}`);
}

function getFundStats(): FundStats {
  const deposits = db.prepare(`
    SELECT COALESCE(SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END), 0) AS total_approved
    FROM deposits
  `).get() as { total_approved: number };

  const withdrawals = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total_withdrawn
    FROM fund_withdrawals
  `).get() as { total_withdrawn: number };

  return {
    total_approved: Number(deposits.total_approved || 0),
    total_withdrawn: Number(withdrawals.total_withdrawn || 0),
  };
}

export async function GET() {
  try {
    await requireFundManager();
    const stats = getFundStats();
    const remaining = stats.total_approved - stats.total_withdrawn;
    const withdrawals = db.prepare(`
      SELECT w.*, u.username
      FROM fund_withdrawals w
      LEFT JOIN users u ON u.id = w.created_by
      ORDER BY w.id DESC
      LIMIT 200
    `).all();

    return ok({ stats: { ...stats, remaining }, withdrawals });
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Không có quyền', 403);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireFundManager();
    const body = await readBody(req);
    const action = String(body.action || '').trim();
    if (action !== 'withdraw') {
      return fail('Action không hợp lệ');
    }

    const amount = Math.trunc(toNumber(body.amount, 0));
    const note = String(body.note || '').trim();
    if (!Number.isFinite(amount) || amount <= 0) {
      if (isFormRequest(req)) return redirectToFunds(req, '?error=amount');
      return fail('Số tiền rút không hợp lệ');
    }

    const stats = getFundStats();
    const remaining = stats.total_approved - stats.total_withdrawn;
    if (amount > remaining) {
      if (isFormRequest(req)) return redirectToFunds(req, '?error=overdraw');
      return fail('Số tiền rút lớn hơn quỹ còn lại');
    }

    const now = nowIso();
    const withdrawalId = runTx(() => {
      const result = db.prepare(`
        INSERT INTO fund_withdrawals (amount, note, created_by, created_at)
        VALUES (?, ?, ?, ?)
      `).run(amount, note, user.id, now);
      return Number(result.lastInsertRowid || 0);
    });

    if (isFormRequest(req)) return redirectToFunds(req, '?ok=withdrawn');
    return ok({ message: 'Đã ghi nhận rút tiền', id: withdrawalId });
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Không thể ghi nhận rút tiền', 403);
  }
}
