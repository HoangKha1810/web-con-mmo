import 'server-only';

import { normalizeBaseUrl, toNumber } from '@/lib/utils';

const upstreamBaseUrl = normalizeBaseUrl(process.env.UPSTREAM_BASE_URL || 'https://trungtammmo.vn');
const upstreamApiKey = process.env.UPSTREAM_API_KEY || '';

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
  return upstreamFetch('/api/external/smm/deposit', {
    method: 'POST',
    json: {
      amount: Math.max(0, Math.trunc(toNumber(input.amount, 0))),
      external_ref: input.externalRef,
      note: input.note || 'Nạp tiền từ Hệ Thống Sub',
    },
  });
}

export async function createSourceDepositCheckout(input: {
  amount: number;
  externalRef: string;
  note?: string;
}) {
  return upstreamFetch('/api/external/smm/deposit/checkout', {
    method: 'POST',
    json: {
      amount: Math.max(0, Math.trunc(toNumber(input.amount, 0))),
      external_ref: input.externalRef,
      note: input.note || 'Nạp tiền từ Hệ Thống Sub',
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

function transactionMatchesReference(transaction: UpstreamTransaction, externalRef: string) {
  const needle = externalRef.trim().toUpperCase();
  if (!needle) return false;
  const values = [
    transaction.external_ref,
    transaction.content,
    ...(Array.isArray(transaction.payment_refs) ? transaction.payment_refs : []),
  ].map((value) => String(value || '').toUpperCase());

  return values.some((value) => value === needle || value.includes(needle));
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
