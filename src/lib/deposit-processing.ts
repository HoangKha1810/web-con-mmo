import 'server-only';

import { db, runTx } from '@/lib/db';
import { topUpSourceBalance } from '@/lib/upstream';
import { extractSePayPaymentReferenceCodes, getPrimarySePayReferenceCode } from '@/lib/sepay-codes';
import { nowIso, toNumber } from '@/lib/utils';

type DepositRow = {
  id: number;
  user_id: number;
  amount: number;
  content: string;
  note: string;
  status: string;
  external_ref: string;
};

function findDepositByCode(code: string) {
  const exact = db.prepare(`
    SELECT *
    FROM deposits
    WHERE content = ? OR external_ref = ?
    ORDER BY id DESC
    LIMIT 1
  `).get(code, code) as DepositRow | undefined;
  if (exact) return exact;

  const rows = db.prepare(`
    SELECT *
    FROM deposits
    WHERE content LIKE ?
    ORDER BY id DESC
    LIMIT 20
  `).all(`%${code}%`) as DepositRow[];

  return rows.find((row) => extractSePayPaymentReferenceCodes(row.content).includes(code));
}

export async function processSePayDepositByCode(code: string, paidAmount?: number) {
  const normalizedCode = String(code || '').trim();
  if (!normalizedCode) {
    throw new Error('Thiếu mã giao dịch SePay');
  }

  const deposit = findDepositByCode(normalizedCode);
  if (!deposit) return { state: 'missing' as const, code: normalizedCode };
  if (deposit.status === 'approved') return { state: 'already_processed' as const, id: deposit.id, code: normalizedCode };
  if (deposit.status === 'rejected' || deposit.status === 'failed') return { state: 'failed' as const, id: deposit.id, code: normalizedCode };

  const expectedAmount = Math.trunc(toNumber(deposit.amount, 0));
  const amount = Math.trunc(toNumber(paidAmount, 0)) || expectedAmount;
  if (amount < expectedAmount) {
    return {
      state: 'amount_mismatch' as const,
      id: deposit.id,
      code: normalizedCode,
      expected_amount: expectedAmount,
      paid_amount: amount,
    };
  }

  const primaryCode = getPrimarySePayReferenceCode(deposit.content) || normalizedCode;
  const sourceTopup = await topUpSourceBalance({
    amount: expectedAmount,
    externalRef: primaryCode,
    note: `SePay hethongsub deposit #${deposit.id}`,
  });
  const sourceTransactionId = String(sourceTopup?.transaction_id || sourceTopup?.data?.transaction_id || '');
  const now = nowIso();
  let balanceAfter = 0;

  runTx(() => {
    const user = db.prepare('SELECT balance FROM users WHERE id = ? LIMIT 1').get(deposit.user_id) as { balance: number } | undefined;
    if (!user) throw new Error('Không tìm thấy user của lệnh nạp');
    const before = Number(user.balance || 0);
    balanceAfter = before + expectedAmount;

    db.prepare('UPDATE users SET balance = ?, updated_at = ? WHERE id = ?').run(balanceAfter, now, deposit.user_id);
    db.prepare(`
      UPDATE deposits
      SET status = 'approved', admin_note = ?, external_ref = ?, updated_at = ?
      WHERE id = ?
    `).run(sourceTransactionId ? `SePay auto approved | source_tx=${sourceTransactionId}` : 'SePay auto approved', primaryCode, now, deposit.id);
    db.prepare(`
      INSERT INTO ledger (user_id, type, amount, balance_before, balance_after, ref_type, ref_id, note, created_at)
      VALUES (?, 'deposit_sepay', ?, ?, ?, 'deposit', ?, ?, ?)
    `).run(
      deposit.user_id,
      expectedAmount,
      before,
      balanceAfter,
      deposit.id,
      `SePay đã thanh toán, nguồn API đã cộng${sourceTransactionId ? ` #${sourceTransactionId}` : ''}`,
      now
    );
  });

  return {
    state: 'processed' as const,
    id: deposit.id,
    code: normalizedCode,
    amount: expectedAmount,
    balance: balanceAfter,
    source: sourceTopup,
  };
}
