import 'server-only';

import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { db, type UserRow } from '@/lib/db';
import { nowIso } from '@/lib/utils';

export const SESSION_COOKIE = 'hss_session';

function makeToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function publicUser(row: UserRow) {
  return {
    id: Number(row.id),
    username: row.username,
    email: row.email,
    full_name: row.full_name || '',
    avatar_url: row.avatar_url || '',
    role: row.role,
    status: row.status,
    balance: Number(row.balance || 0),
    created_at: row.created_at,
  };
}

export async function getCurrentUser() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const row = db.prepare(`
    SELECT u.id, u.username, u.email, u.full_name, u.avatar_url, u.role, u.status, u.balance, u.created_at, u.updated_at
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND s.expires_at > ?
    LIMIT 1
  `).get(token, nowIso()) as UserRow | undefined;

  if (!row || row.status !== 'active') return null;
  return publicUser(row);
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Bạn cần đăng nhập');
  }
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== 'admin') {
    throw new Error('Bạn không có quyền admin');
  }
  return user;
}

export async function createSession(userId: number) {
  const token = makeToken();
  const now = new Date();
  const expires = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30);
  db.prepare('INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)').run(
    token,
    userId,
    expires.toISOString(),
    now.toISOString()
  );

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires,
  });
}

export async function clearSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }
  jar.delete(SESSION_COOKIE);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compareSync(password, hash);
}

export function hashPassword(password: string) {
  return bcrypt.hashSync(password, 12);
}
