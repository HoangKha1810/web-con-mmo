type ClassValue = string | number | false | null | undefined | Record<string, boolean | null | undefined>;

export function cn(...inputs: ClassValue[]) {
  return inputs
    .flatMap((input) => {
      if (!input) return [];
      if (typeof input === 'object') {
        return Object.entries(input)
          .filter(([, enabled]) => Boolean(enabled))
          .map(([className]) => className);
      }
      return [String(input)];
    })
    .join(' ');
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export function formatDateTimeVi(value: string | Date | number) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || '');
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

export function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function nowIso() {
  return new Date().toISOString();
}

export function normalizeBaseUrl(value?: string | null) {
  const raw = String(value || '').trim();
  if (!raw) return 'https://trungtammmo.vn';
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withProtocol.replace(/\/+$/, '');
}

export function randomToken(bytes = 32) {
  return crypto.randomUUID().replace(/-/g, '') + Math.random().toString(36).slice(2, 10);
}
