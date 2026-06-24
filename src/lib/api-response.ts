import { NextResponse } from 'next/server';

export function ok(data: Record<string, unknown> = {}) {
  return NextResponse.json({ success: true, ...data });
}

export function fail(message: string, status = 400, data: Record<string, unknown> = {}) {
  return NextResponse.json({ success: false, message, ...data }, { status });
}

export function isFormRequest(req: Request) {
  const contentType = req.headers.get('content-type') || '';
  return contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data');
}

export function redirectResponse(req: Request, path: string) {
  return Response.redirect(new URL(path, req.url), 303);
}

export async function readBody(req: Request) {
  const contentType = req.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const body = await req.json().catch(() => ({}));
    return body && typeof body === 'object' ? body as Record<string, unknown> : {};
  }

  const form = await req.formData().catch(() => null);
  if (form) {
    return Object.fromEntries(form.entries());
  }

  return {};
}
