import 'server-only';

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const SIGNATURE_FIELD_ORDER = [
  'merchant',
  'operation',
  'payment_method',
  'order_amount',
  'currency',
  'order_invoice_number',
  'order_description',
  'customer_id',
  'success_url',
  'error_url',
  'cancel_url',
] as const;

type SePayFields = Record<string, string>;

type BuildSePayCheckoutInput = {
  amount: number;
  customerId?: string;
  description: string;
  orderId: string;
  origin?: string;
  paymentMethod?: 'BANK_TRANSFER' | 'CARD';
};

let envFileCache: Record<string, string> | null = null;

function parseEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return {};
  const rows: Record<string, string> = {};
  const text = fs.readFileSync(filePath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index <= 0) continue;
    const key = trimmed.slice(0, index).trim();
    const rawValue = trimmed.slice(index + 1).trim();
    rows[key] = rawValue.replace(/^['"]|['"]$/g, '');
  }
  return rows;
}

function readExternalEnvFiles() {
  if (envFileCache) return envFileCache;
  const candidates = [
    path.resolve(process.cwd(), '../mmo/FE/.env'),
    path.resolve(process.cwd(), '../mmo/FE/.env.local'),
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '.env.local'),
  ];
  envFileCache = candidates.reduce((acc, filePath) => ({ ...acc, ...parseEnvFile(filePath) }), {});
  return envFileCache;
}

function getEnv(name: string, fallback = '') {
  const rows = readExternalEnvFiles();
  return (
    process.env[`HETHONGSUB_${name}`]?.trim() ||
    process.env[name]?.trim() ||
    rows[`HETHONGSUB_${name}`] ||
    rows[name] ||
    fallback
  );
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

function readEnvFileValue(name: string) {
  const rows = readExternalEnvFiles();
  return rows[name]?.trim() || '';
}

function normalizeUrl(value: string) {
  const raw = value.trim();
  if (!raw) return '';
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function isPublicCallbackOrigin(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      !['localhost', '127.0.0.1', '0.0.0.0', '[::1]'].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

function callbackBase(origin?: string) {
  const configured =
    process.env.HETHONGSUB_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_HETHONGSUB_BASE_URL?.trim() ||
    readEnvFileValue('HETHONGSUB_BASE_URL') ||
    readEnvFileValue('NEXT_PUBLIC_HETHONGSUB_BASE_URL');

  if (configured) return trimTrailingSlash(normalizeUrl(configured));
  if (origin && isPublicCallbackOrigin(origin)) return trimTrailingSlash(origin);
  return 'https://hethongsub.vn';
}

export function getSePayConfig(origin?: string) {
  const mode = getEnv('SEPAY_MODE', 'production').toLowerCase();
  const base = callbackBase(origin);
  return {
    mode,
    merchantId: getEnv('SEPAY_MERCHANT_ID'),
    secretKey: getEnv('SEPAY_SECRET_KEY'),
    apiToken: getEnv('SEPAY_API_TOKEN') || getEnv('SEPAY_API_KEY'),
    webhookToken: getEnv('SEPAY_WEBHOOK_TOKEN'),
    checkoutUrl:
      mode === 'production'
        ? 'https://pay.sepay.vn/v1/checkout/init'
        : 'https://pay-sandbox.sepay.vn/v1/checkout/init',
    ipnUrl: getEnv('SEPAY_IPN_URL_OVERRIDE') || `${base}/api/payment/sepay/ipn`,
    successUrl: getEnv('SEPAY_SUCCESS_URL_OVERRIDE') || `${base}/wallet?payment=success`,
    errorUrl: getEnv('SEPAY_ERROR_URL_OVERRIDE') || `${base}/wallet?payment=error`,
    cancelUrl: getEnv('SEPAY_CANCEL_URL_OVERRIDE') || `${base}/wallet?payment=cancel`,
  };
}

export function generateSePaySignature(fields: SePayFields, secretKey: string) {
  const signed = SIGNATURE_FIELD_ORDER.flatMap((fieldName) => {
    const value = fields[fieldName];
    return typeof value === 'string' ? [`${fieldName}=${value}`] : [];
  });

  return crypto.createHmac('sha256', secretKey).update(signed.join(',')).digest('base64');
}

export function buildSePayCheckout(input: BuildSePayCheckoutInput) {
  const config = getSePayConfig(input.origin);
  if (!config.merchantId || !config.secretKey) {
    return {
      success: false as const,
      message: 'Thiếu cấu hình SePay merchant_id hoặc secret_key',
    };
  }

  const fields: SePayFields = {
    merchant: config.merchantId,
    currency: 'VND',
    order_amount: String(Math.trunc(input.amount)),
    operation: 'PURCHASE',
    order_description: input.description,
    order_invoice_number: input.orderId,
    customer_id: input.customerId || '',
    success_url: config.successUrl,
    error_url: config.errorUrl,
    cancel_url: config.cancelUrl,
  };

  if (input.paymentMethod) {
    fields.payment_method = input.paymentMethod;
  }

  fields.signature = generateSePaySignature(fields, config.secretKey);

  return {
    success: true as const,
    checkoutUrl: config.checkoutUrl,
    config,
    fields,
  };
}

export async function createSePayCheckoutSession(input: BuildSePayCheckoutInput) {
  const checkout = buildSePayCheckout(input);
  if (!checkout.success) return checkout;

  return {
    success: true as const,
    checkoutUrl: checkout.checkoutUrl,
    redirectUrl: '',
    sepayOrderId: '',
    config: checkout.config,
    fields: checkout.fields,
  };
}

export function verifySePayIpn(headers: Headers) {
  const config = getSePayConfig();
  const authorizationHeader = headers.get('authorization') || headers.get('Authorization') || '';
  const authorizationToken = authorizationHeader
    .replace(/^apikey\s+/i, '')
    .replace(/^bearer\s+/i, '')
    .trim();
  const receivedSecrets = [
    headers.get('x-secret-key') || '',
    headers.get('X-Secret-Key') || '',
    headers.get('x_secret_key') || '',
    authorizationToken,
  ].filter(Boolean);
  const validSecrets = [config.webhookToken, config.secretKey].filter((value): value is string => Boolean(value && value.trim()));

  if (!validSecrets.length) {
    return { success: false as const, message: 'Chưa cấu hình SEPAY_WEBHOOK_TOKEN / SEPAY_SECRET_KEY' };
  }

  const matched = validSecrets.some((secret) => {
    const expected = Buffer.from(secret);
    return receivedSecrets.some((candidate) => {
      const received = Buffer.from(candidate);
      return expected.length === received.length && crypto.timingSafeEqual(expected, received);
    });
  });

  return matched
    ? { success: true as const }
    : { success: false as const, message: 'SePay authorization không hợp lệ' };
}
