import { NextRequest, NextResponse } from 'next/server';
import { processSePayDepositByCode } from '@/lib/deposit-processing';
import { extractSePayPaymentReferenceCodes } from '@/lib/sepay-codes';
import { verifySePayIpn } from '@/lib/sepay';
import { toNumber } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function extractIp(req: NextRequest) {
  return req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
}

function extractCodes(payload: Record<string, unknown>) {
  const order = (payload.order || {}) as Record<string, unknown>;
  const transaction = (payload.transaction || {}) as Record<string, unknown>;
  const unique = new Set<string>();

  [
    order.order_invoice_number,
    payload.order_invoice_number,
    payload.order_code,
    payload.code,
    transaction.reference_number,
    transaction.transaction_content,
    transaction.content,
    payload.content,
    payload.description,
    payload.transferContent,
    payload.transfer_content,
  ].forEach((value) => {
    extractSePayPaymentReferenceCodes(String(value || '')).forEach((code) => unique.add(code));
  });

  return Array.from(unique);
}

async function processCandidates(codes: string[], amount: number) {
  let lastResult: Awaited<ReturnType<typeof processSePayDepositByCode>> | null = null;

  for (const code of codes) {
    const result = await processSePayDepositByCode(code, amount);
    lastResult = result;
    if (result.state === 'processed' || result.state === 'already_processed') {
      return result;
    }
  }

  return lastResult || { state: 'missing' as const };
}

export async function POST(req: NextRequest) {
  const ip = extractIp(req);
  let payload: Record<string, unknown>;

  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON payload' }, { status: 400 });
  }

  const verified = verifySePayIpn(req.headers);
  if (!verified.success) {
    return NextResponse.json({ success: false, message: verified.message }, { status: 401 });
  }

  const notificationType = String(payload.notification_type || '').trim().toUpperCase();
  const transferType = String(payload.transferType || payload.transfer_type || '').trim().toLowerCase();
  const order = (payload.order || {}) as Record<string, unknown>;
  const transaction = (payload.transaction || {}) as Record<string, unknown>;
  const orderStatus = String(order.order_status || '').trim().toUpperCase();
  const transactionStatus = String(transaction.transaction_status || '').trim().toUpperCase();
  const codes = extractCodes(payload);

  if (!codes.length) {
    return NextResponse.json({ success: true, ip_address: ip, message: 'No matching hethongsub payment code' });
  }

  if (notificationType === 'ORDER_PAID' && transactionStatus !== 'APPROVED' && orderStatus !== 'CAPTURED') {
    return NextResponse.json({ success: true, ip_address: ip, message: 'Ignored payment status' });
  }

  if (notificationType !== 'ORDER_PAID' && transferType && transferType !== 'in') {
    return NextResponse.json({ success: true, ip_address: ip, message: 'Ignored non-in transfer' });
  }

  const amount = toNumber(
    transaction.transaction_amount ?? payload.transferAmount ?? payload.transfer_amount ?? payload.amount,
    0
  );

  try {
    const result = await processCandidates(codes, amount);
    return NextResponse.json({ success: true, ip_address: ip, data: result });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Failed to process IPN' },
      { status: 500 }
    );
  }
}
