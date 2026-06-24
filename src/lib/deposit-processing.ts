import 'server-only';

import { db, runTx } from '@/lib/db';
import { verifySourceDeposit, type UpstreamTransaction } from '@/lib/upstream';
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

function resolveSourceRef(deposit: DepositRow, fallbackCode = '') {
  const directRef = String(deposit.external_ref || '').trim();
  if (directRef) return directRef;

  const codes = extractSePayPaymentReferenceCodes(deposit.content);
  const heThongSubCode = codes.find((code) => /^HSSSEP/i.test(code));
  return heThongSubCode || fallbackCode;
}

function rememberSourcePending(depositId: number, message: string) {
  db.prepare(`
    UPDATE deposits
    SET admin_note = ?, updated_at = ?
    WHERE id = ? AND status = 'pending'
  `).run(message.slice(0, 500), nowIso(), depositId);
}

function approveDepositFromVerifiedSource(
  deposit: DepositRow,
  sourceRef: string,
  sourceTransaction: UpstreamTransaction
) {
  const sourceTransactionId = String(sourceTransaction.transaction_id || sourceTransaction.id || '');
  const now = nowIso();
  const expectedAmount = Math.trunc(toNumber(deposit.amount, 0));
  let balanceAfter = 0;

  runTx(() => {
    const current = db.prepare('SELECT status FROM deposits WHERE id = ? LIMIT 1').get(deposit.id) as { status: string } | undefined;
    if (!current || current.status !== 'pending') {
      return;
    }

    const user = db.prepare('SELECT balance FROM users WHERE id = ? LIMIT 1').get(deposit.user_id) as { balance: number } | undefined;
    if (!user) throw new Error('Không tìm thấy user của lệnh nạp');

    const before = Number(user.balance || 0);
    balanceAfter = before + expectedAmount;

    db.prepare('UPDATE users SET balance = ?, updated_at = ? WHERE id = ?').run(balanceAfter, now, deposit.user_id);
    db.prepare(`
      UPDATE deposits
      SET status = 'approved', admin_note = ?, external_ref = ?, updated_at = ?
      WHERE id = ? AND status = 'pending'
    `).run(
      sourceTransactionId
        ? `SePay source verified | source_tx=${sourceTransactionId}`
        : 'SePay source verified',
      sourceRef,
      now,
      deposit.id
    );
    db.prepare(`
      INSERT INTO ledger (user_id, type, amount, balance_before, balance_after, ref_type, ref_id, note, created_at)
      VALUES (?, 'deposit_sepay', ?, ?, ?, 'deposit', ?, ?, ?)
    `).run(
      deposit.user_id,
      expectedAmount,
      before,
      balanceAfter,
      deposit.id,
      `SePay đã thanh toán, nguồn API đã xác nhận cộng${sourceTransactionId ? ` #${sourceTransactionId}` : ''}`,
      now
    );
  });

  return {
    balanceAfter,
    sourceTransactionId,
  };
}

export async function syncPendingDepositsFromUpstream(input: {
  userId?: number;
  limit?: number;
} = {}) {
  const limit = Math.min(Math.max(Math.trunc(toNumber(input.limit, 10)), 1), 30);
  const rows = (input.userId
    ? db.prepare(`
        SELECT *
        FROM deposits
        WHERE user_id = ? AND status = 'pending'
        ORDER BY id ASC
        LIMIT ?
      `).all(input.userId, limit)
    : db.prepare(`
        SELECT *
        FROM deposits
        WHERE status = 'pending'
        ORDER BY id ASC
        LIMIT ?
      `).all(limit)) as DepositRow[];

  let checked = 0;
  let processed = 0;
  const errors: Array<{ id: number; message: string }> = [];

  for (const deposit of rows) {
    const sourceRef = resolveSourceRef(deposit, getPrimarySePayReferenceCode(deposit.content));
    if (!sourceRef) continue;

    checked += 1;
    try {
      const sourceTransaction = await verifySourceDeposit({
        externalRef: sourceRef,
        amount: deposit.amount,
      });
      approveDepositFromVerifiedSource(deposit, sourceRef, sourceTransaction);
      processed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Chưa xác nhận được nguồn API';
      rememberSourcePending(deposit.id, `Chờ đối soát nguồn API: ${message}`);
      errors.push({ id: deposit.id, message });
    }
  }

  return { checked, processed, errors };
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
  const sourceRef = resolveSourceRef(deposit, primaryCode);
  let sourceTransaction: UpstreamTransaction;

  try {
    sourceTransaction = await verifySourceDeposit({
      externalRef: sourceRef,
      amount: expectedAmount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Chưa xác nhận được nguồn API';
    rememberSourcePending(deposit.id, `Đã thấy SePay, chờ web chính cộng nguồn API: ${message}`);
    return {
      state: 'source_pending' as const,
      id: deposit.id,
      code: normalizedCode,
      source_ref: sourceRef,
      message,
    };
  }

  const approved = approveDepositFromVerifiedSource(deposit, sourceRef, sourceTransaction);

  return {
    state: 'processed' as const,
    id: deposit.id,
    code: normalizedCode,
    amount: expectedAmount,
    balance: approved.balanceAfter,
    source: sourceTransaction,
  };
}
