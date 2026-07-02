import { NextRequest, NextResponse } from 'next/server';

const STATIC_PATH_PREFIXES = [
  '/_next/',
  '/assets/',
  '/brand/',
  '/favicon',
  '/robots.txt',
  '/sitemap.xml',
  '/manifest.webmanifest',
  '/icon-',
  '/apple-icon',
];

function base64url(bytes: ArrayBuffer) {
  const raw = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function generateNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return base64url(bytes.buffer);
}

function isStaticPath(pathname: string) {
  return STATIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function buildSecurityHeaders(req: NextRequest, nonce = '') {
  const isDev = process.env.NODE_ENV !== 'production';
  const connectSrc = [
    "'self'",
    'https:',
    'wss:',
    ...(isDev ? ['http://localhost:*', 'ws://localhost:*'] : []),
  ].join(' ');
  const scriptSrc = [
    "'self'",
    nonce ? `'nonce-${nonce}'` : '',
    "'wasm-unsafe-eval'",
    ...(isDev ? ["'unsafe-eval'"] : []),
  ].filter(Boolean).join(' ');
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    `script-src ${scriptSrc}`,
    `connect-src ${connectSrc}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    ...(req.nextUrl.protocol === 'https:' ? ['upgrade-insecure-requests'] : []),
  ].join('; ');

  return {
    'Content-Security-Policy': csp,
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), clipboard-read=(), clipboard-write=(self)',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Origin-Agent-Cluster': '?1',
    'X-DNS-Prefetch-Control': 'off',
  };
}

function applySecurityHeaders(response: NextResponse, req: NextRequest, nonce = '') {
  for (const [key, value] of Object.entries(buildSecurityHeaders(req, nonce))) {
    response.headers.set(key, value);
  }
  return response;
}

export function middleware(req: NextRequest) {
  if (isStaticPath(req.nextUrl.pathname)) {
    return applySecurityHeaders(NextResponse.next(), req);
  }

  const nonce = generateNonce();
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', buildSecurityHeaders(req, nonce)['Content-Security-Policy']);

  return applySecurityHeaders(NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  }), req, nonce);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
