import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function extractFacebookId(url: string) {
  const patterns = [
    /(?:profile\.php\?id=|facebook\.com\/)(\d{6,})/i,
    /(?:groups|posts|photos|videos|permalink|story\.php\?story_fbid=|fbid=)\/?(\d{6,})/i,
    /[?&](?:id|fbid|story_fbid)=(\d{6,})/i,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }

  return '';
}

function normalizeUrl(value: string) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    parsed.hash = '';
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return raw;
  }
}

function stripQuery(value: string) {
  try {
    const parsed = new URL(value);
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return value.split('?')[0]?.replace(/\/+$/, '') || value;
  }
}

async function postForm(requestUrl: string, body: Record<string, string>, headers: Record<string, string> = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ...headers,
      },
      body: new URLSearchParams(body),
      signal: controller.signal,
      cache: 'no-store',
    });

    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveFacebookUid(url: string) {
  const originalUrl = String(url || '').trim();
  const cleanedUrl = stripQuery(normalizeUrl(originalUrl));
  const directUid = extractFacebookId(originalUrl) || extractFacebookId(cleanedUrl);
  if (directUid) return directUid;

  try {
    const tdsResponse = await postForm(
      'https://id.traodoisub.com/api.php',
      { link: originalUrl },
      { Referer: 'https://id.traodoisub.com/' }
    );
    if (tdsResponse) {
      const payload = JSON.parse(tdsResponse) as { id?: string | number };
      const candidate = String(payload?.id || '').trim();
      if (/^\d{6,}$/.test(candidate)) return candidate;
    }
  } catch {
    // Fallback below.
  }

  try {
    const atpResponse = await postForm('https://id.atpsoftware.vn/api/getUID', { link: originalUrl });
    if (atpResponse) {
      try {
        const payload = JSON.parse(atpResponse) as { id?: string | number };
        const candidate = String(payload?.id || '').trim();
        if (/^\d{6,}$/.test(candidate)) return candidate;
      } catch {
        const cleaned = atpResponse.trim();
        if (/^\d{6,}$/.test(cleaned)) return cleaned;
      }
    }
  } catch {
    // Final failure handled by caller.
  }

  return '';
}

function extractNonFacebookId(url: string) {
  const value = normalizeUrl(url);

  const tiktokVideo = value.match(/tiktok\.com\/@[\w.-]+\/video\/(\d+)/i);
  if (tiktokVideo?.[1]) return { id: tiktokVideo[1], platform: 'TikTok' };
  const tiktokUser = value.match(/tiktok\.com\/@([\w.-]+)/i);
  if (tiktokUser?.[1]) return { id: `@${tiktokUser[1]}`, platform: 'TikTok' };

  const instagramPost = value.match(/instagram\.com\/(?:p|reel|reels)\/([^/?#]+)/i);
  if (instagramPost?.[1]) return { id: instagramPost[1], platform: 'Instagram' };
  const instagramUser = value.match(/instagram\.com\/([a-zA-Z0-9._-]+)/i);
  if (instagramUser?.[1] && !['p', 'reel', 'reels', 'stories', 'explore'].includes(instagramUser[1].toLowerCase())) {
    return { id: instagramUser[1], platform: 'Instagram' };
  }

  const threadsPost = value.match(/threads\.net\/@([\w.-]+)\/post\/([^/?#]+)/i);
  if (threadsPost?.[2]) return { id: threadsPost[2], platform: 'Threads' };
  const threadsUser = value.match(/threads\.net\/@([\w.-]+)/i);
  if (threadsUser?.[1]) return { id: `@${threadsUser[1]}`, platform: 'Threads' };

  const xStatus = value.match(/(?:twitter|x)\.com\/[\w.-]+\/status\/(\d+)/i);
  if (xStatus?.[1]) return { id: xStatus[1], platform: 'X / Twitter' };
  const xUser = value.match(/(?:twitter|x)\.com\/([\w.-]+)/i);
  if (xUser?.[1] && !['home', 'explore', 'notifications', 'messages', 'i'].includes(xUser[1].toLowerCase())) {
    return { id: xUser[1], platform: 'X / Twitter' };
  }

  const youtubeWatch = value.match(/[?&]v=([a-zA-Z0-9_-]{6,})/i);
  if (youtubeWatch?.[1]) return { id: youtubeWatch[1], platform: 'YouTube' };
  const youtubeShort = value.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{6,})/i);
  if (youtubeShort?.[1]) return { id: youtubeShort[1], platform: 'YouTube' };
  const youtubeChannel = value.match(/youtube\.com\/(?:channel\/|@)([a-zA-Z0-9_.-]+)/i);
  if (youtubeChannel?.[1]) return { id: youtubeChannel[1].startsWith('@') ? youtubeChannel[1] : youtubeChannel[1], platform: 'YouTube' };

  const telegramPost = value.match(/(?:t\.me|telegram\.me)\/([a-zA-Z0-9_]+)\/(\d+)/i);
  if (telegramPost?.[1] && telegramPost?.[2]) return { id: `${telegramPost[1]}/${telegramPost[2]}`, platform: 'Telegram' };
  const telegramUser = value.match(/(?:t\.me|telegram\.me)\/([a-zA-Z0-9_]+)/i);
  if (telegramUser?.[1]) return { id: `@${telegramUser[1]}`, platform: 'Telegram' };

  return null;
}

export async function POST(req: Request) {
  try {
    await requireUser();
    const body = await req.json().catch(() => ({}));
    const url = String(body.url || '').trim();

    if (!url) {
      return NextResponse.json({ success: false, message: 'Vui lòng nhập link hoặc ID cần chạy.' }, { status: 400 });
    }

    if (/^\d{6,}$/.test(url) || /^@[a-zA-Z0-9._-]{2,}$/.test(url)) {
      return NextResponse.json({ success: true, id: url, uid: url, platform: body.platform || 'Social' });
    }

    if (/facebook\.com|fb\.com|fb\.watch/i.test(url)) {
      const uid = await resolveFacebookUid(url);
      if (uid) {
        return NextResponse.json({ success: true, id: uid, uid, platform: 'Facebook' });
      }
      return NextResponse.json({
        success: false,
        message: 'Không lấy được UID Facebook. Hãy thử link công khai, link gốc sau redirect hoặc nhập trực tiếp ID.',
      });
    }

    const extracted = extractNonFacebookId(url);
    if (extracted?.id) {
      return NextResponse.json({ success: true, id: extracted.id, platform: extracted.platform });
    }

    return NextResponse.json({
      success: false,
      message: 'Không nhận diện được ID từ liên kết này. Bạn có thể nhập trực tiếp ID/username nếu dịch vụ yêu cầu.',
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Không thể lấy ID lúc này' },
      { status: 400 }
    );
  }
}
