import 'server-only';

import crypto from 'node:crypto';
import { normalizeBaseUrl, toNumber } from '@/lib/utils';

const upstreamBaseUrl = normalizeBaseUrl(process.env.UPSTREAM_BASE_URL || 'https://trungtammmo.vn');
const upstreamApiKey = process.env.UPSTREAM_API_KEY || '';
const upstreamDepositSecret = process.env.UPSTREAM_DEPOSIT_SECRET || process.env.EXTERNAL_API_DEPOSIT_SECRET || '';
const upstreamDepositSignatureSecret =
  process.env.UPSTREAM_DEPOSIT_SIGNATURE_SECRET ||
  process.env.EXTERNAL_API_DEPOSIT_SIGNATURE_SECRET ||
  '';
const configuredUpstreamDepositUserId = String(process.env.UPSTREAM_DEPOSIT_USER_ID || '').trim();
let cachedUpstreamDepositUserId = '';

type FetchOptions = RequestInit & {
  json?: Record<string, unknown>;
};

async function upstreamFetch(path: string, options: FetchOptions = {}) {
  if (!upstreamApiKey) {
    throw new Error('Chưa cấu hình UPSTREAM_API_KEY');
  }

  const headers = new Headers(options.headers);
  headers.set('x-api-key', upstreamApiKey);
  if (options.json) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${upstreamBaseUrl}${path}`, {
    ...options,
    cache: 'no-store',
    headers,
    body: options.json ? JSON.stringify(options.json) : options.body,
  });
  const text = await res.text();
  let payload: any;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { success: false, message: text || `HTTP ${res.status}` };
  }

  if (!res.ok || payload?.success === false) {
    throw new Error(payload?.message || `Upstream HTTP ${res.status}`);
  }

  return payload;
}

async function resolveUpstreamDepositUserId() {
  if (cachedUpstreamDepositUserId) {
    return cachedUpstreamDepositUserId;
  }

  try {
    const payload = await upstreamFetch('/api/external/smm/profile');
    const userId = String(
      payload?.data?.user_id ||
      payload?.user_id ||
      payload?.data?.id ||
      ''
    ).trim();
    if (userId) {
      cachedUpstreamDepositUserId = userId;
      return cachedUpstreamDepositUserId;
    }
  } catch {
    // Fall back to explicit env below so existing VPS configs keep working.
  }

  cachedUpstreamDepositUserId = configuredUpstreamDepositUserId;
  return cachedUpstreamDepositUserId;
}

async function buildDepositSignature(input: { amount: number; externalRef: string }) {
  if (!upstreamDepositSignatureSecret) {
    return '';
  }

  const userId = await resolveUpstreamDepositUserId();
  if (!userId) {
    throw new Error('Không lấy được user_id nguồn API để ký HMAC nạp tiền');
  }

  return crypto
    .createHmac('sha256', upstreamDepositSignatureSecret)
    .update(`${input.amount}|${input.externalRef}|${userId}`)
    .digest('hex');
}

export type UpstreamSmmService = {
  service: number;
  id?: number;
  provider_id?: number;
  name: string;
  category?: string;
  platform?: string;
  min?: number;
  max?: number;
  price_per_1k_vnd?: number;
  price_per_unit_vnd?: number;
  is_comment_service?: boolean;
};

export type UpstreamAutoMxhService = {
  id: number;
  variant_id: number;
  product_id: number;
  product_name?: string;
  name: string;
  category?: { id?: number; name?: string; slug?: string };
  quantity?: number;
  price?: number;
  api_provider_id?: number;
  api_service_id?: string;
};

export async function getUpstreamBalance() {
  const payload = await upstreamFetch('/api/external/smm/balance');
  return toNumber(payload.balance, 0);
}

export async function topUpSourceBalance(input: {
  amount: number;
  externalRef: string;
  note?: string;
}) {
  const amount = Math.max(0, Math.trunc(toNumber(input.amount, 0)));
  const externalRef = String(input.externalRef || '').trim();
  const json: Record<string, unknown> = {
    amount,
    external_ref: externalRef,
    note: input.note || 'Nạp tiền từ Hệ Thống Sub',
  };
  if (upstreamDepositSecret) {
    json.deposit_secret = upstreamDepositSecret;
  }

  const signature = await buildDepositSignature({ amount, externalRef });
  return upstreamFetch('/api/external/smm/deposit', {
    method: 'POST',
    headers: signature ? { 'x-deposit-signature': signature } : undefined,
    json,
  });
}

export async function createSourceDepositCheckout(input: {
  amount: number;
  externalRef: string;
  note?: string;
  callbackOrigin?: string;
  successUrl?: string;
  errorUrl?: string;
  cancelUrl?: string;
}) {
  return upstreamFetch('/api/external/smm/deposit/checkout', {
    method: 'POST',
    json: {
      amount: Math.max(0, Math.trunc(toNumber(input.amount, 0))),
      external_ref: input.externalRef,
      note: input.note || 'Nạp tiền từ Hệ Thống Sub',
      callback_origin: input.callbackOrigin,
      success_url: input.successUrl,
      error_url: input.errorUrl,
      cancel_url: input.cancelUrl,
    },
  });
}

export type UpstreamTransaction = {
  id?: number;
  transaction_id?: number | string;
  type?: string;
  status?: string;
  amount?: number;
  balance_after?: number;
  wallet_type?: string;
  content?: string;
  external_ref?: string;
  payment_refs?: string[];
  created_at?: string;
};

export async function fetchSourceTransactions(input: {
  externalRef?: string;
  type?: string;
  status?: string;
  limit?: number;
} = {}) {
  const qs = new URLSearchParams();
  if (input.externalRef) qs.set('external_ref', input.externalRef);
  if (input.type) qs.set('type', input.type);
  if (input.status) qs.set('status', input.status);
  qs.set('per_page', String(Math.min(Math.max(Math.trunc(toNumber(input.limit, 20)), 1), 100)));

  const payload = await upstreamFetch(`/api/external/smm/transactions?${qs}`);
  return Array.isArray(payload.data) ? payload.data as UpstreamTransaction[] : [];
}

function extractExternalRefMarker(value: unknown) {
  return String(value || '')
    .split('|')
    .map((part) => part.trim())
    .find((part) => /^external_ref=/i.test(part))
    ?.replace(/^external_ref=/i, '')
    .trim() || '';
}

function transactionMatchesReference(transaction: UpstreamTransaction, externalRef: string) {
  const needle = externalRef.trim().toUpperCase();
  if (!needle) return false;
  const values = [
    transaction.external_ref,
    extractExternalRefMarker(transaction.content),
    ...(Array.isArray(transaction.payment_refs) ? transaction.payment_refs : []),
  ].map((value) => String(value || '').trim().toUpperCase()).filter(Boolean);

  return values.some((value) => value === needle);
}

export async function verifySourceDeposit(input: {
  externalRef: string;
  amount: number;
}) {
  const expectedAmount = Math.trunc(toNumber(input.amount, 0));
  const externalRef = String(input.externalRef || '').trim();
  if (!externalRef) {
    throw new Error('Thiếu mã đối soát nguồn API');
  }

  const transactions = await fetchSourceTransactions({
    externalRef,
    type: 'deposit',
    status: 'success',
    limit: 20,
  });

  const matched = transactions.find((transaction) => {
    const status = String(transaction.status || '').toLowerCase();
    const type = String(transaction.type || '').toLowerCase();
    const amount = Math.trunc(toNumber(transaction.amount, 0));
    return status === 'success' &&
      type === 'deposit' &&
      amount >= expectedAmount &&
      transactionMatchesReference(transaction, externalRef);
  });

  if (!matched) {
    throw new Error('Chưa thấy giao dịch đã cộng thành công ở tài khoản nguồn API key');
  }

  return matched;
}

export async function fetchSmmServices(search = '') {
  const qs = new URLSearchParams();
  if (search) qs.set('search', search);
  const payload = await upstreamFetch(`/api/external/smm/services${qs.size ? `?${qs}` : ''}`);
  return Array.isArray(payload.data) ? payload.data as UpstreamSmmService[] : [];
}

export async function fetchAutoMxhServices(search = '') {
  const qs = new URLSearchParams();
  if (search) qs.set('search', search);
  const payload = await upstreamFetch(`/api/external/automxh/services${qs.size ? `?${qs}` : ''}`);
  return Array.isArray(payload.data) ? payload.data as UpstreamAutoMxhService[] : [];
}

export async function createSmmOrder(input: {
  service: number;
  provider_id?: number;
  link: string;
  quantity: number;
  comments?: string;
}) {
  return upstreamFetch('/api/external/smm/order', {
    method: 'POST',
    json: input,
  });
}

export async function createAutoMxhOrder(input: {
  service: number;
  product_id?: number;
  link: string;
  buyer_info?: string;
  custom_value?: string;
}) {
  return upstreamFetch('/api/external/automxh/order', {
    method: 'POST',
    json: input,
  });
}

export async function getSmmStatus(order: string) {
  return upstreamFetch(`/api/external/smm/status?order=${encodeURIComponent(order)}`);
}

export async function getAutoMxhStatus(order: string) {
  return upstreamFetch(`/api/external/automxh/status?order=${encodeURIComponent(order)}`);
}

export function upstreamInfo() {
  return {
    baseUrl: upstreamBaseUrl,
    hasApiKey: Boolean(upstreamApiKey),
  };
}
