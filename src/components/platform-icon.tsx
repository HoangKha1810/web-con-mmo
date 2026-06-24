import { Facebook, Hash, Instagram, Send, Twitter, Youtube } from 'lucide-react';
import type { PlatformMeta } from '@/lib/platforms';

function TikTokMark() {
  return (
    <svg className="brand-svg" viewBox="0 0 24 24" aria-hidden="true">
      <path className="tt-shadow-cyan" d="M14.2 3.1v10.2a4.9 4.9 0 1 1-4.9-4.9c.35 0 .7.04 1.02.12v3.05a2.05 2.05 0 1 0 1.55 1.98V3.1h2.33Z" />
      <path className="tt-shadow-pink" d="M15.98 3.1c.45 2.55 1.9 4.02 4.52 4.22v3.12a8.2 8.2 0 0 1-4.52-1.44v4.28a4.9 4.9 0 1 1-4.9-4.9c.33 0 .66.03.97.1v3.05a2.05 2.05 0 1 0 1.6 2V3.1h2.33Z" />
      <path className="tt-main" d="M15.1 3.1c.43 2.28 1.76 3.58 4.08 3.82v2.72a7.3 7.3 0 0 1-4.08-1.3v4.95a4.06 4.06 0 1 1-4.06-4.06c.27 0 .53.03.78.08v2.62a1.43 1.43 0 1 0 1.04 1.38V3.1h2.24Z" />
    </svg>
  );
}

function ThreadsMark() {
  return (
    <svg className="brand-svg" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12.14 2.2c3.28 0 5.82 1.18 7.34 3.4 1.36 1.98 1.8 4.56 1.28 7.46-.58 3.24-2.18 5.78-4.52 7.17-2.02 1.2-4.58 1.42-7.2.62-4.2-1.28-6.5-4.54-6.5-9.18 0-2.86.9-5.21 2.6-6.8 1.64-1.55 4.03-2.37 7-2.37Zm.02 2.12c-2.42 0-4.33.62-5.53 1.8-1.25 1.22-1.9 3.14-1.9 5.55 0 3.72 1.74 6.23 4.9 7.22 2.05.63 4.02.48 5.5-.43 1.8-1.1 3.04-3.08 3.52-5.77.42-2.34.1-4.36-.9-5.83-1.1-1.62-3.04-2.54-5.59-2.54Zm.04 2.58c2.32 0 3.84 1.18 4.24 3.28.7.35 1.26.78 1.66 1.3l-1.52 1.45a4.6 4.6 0 0 0-.32-.32c-.18 2.36-1.82 3.98-4.28 4.16-2.42.18-4.2-.96-4.36-2.8-.14-1.67 1.16-2.9 3.38-3.23.92-.14 1.86-.12 2.77.05-.28-1.17-1.02-1.74-2.2-1.74-1.02 0-1.83.35-2.58 1.1L7.6 8.58C8.72 7.45 10.16 6.9 12.2 6.9Zm.06 5.54c-.32 0-.65.03-.98.08-1.06.16-1.6.57-1.55 1.18.06.68.88 1.08 2.08.98 1.42-.11 2.22-.9 2.1-1.86-.5-.24-1.05-.38-1.65-.38Z"
      />
    </svg>
  );
}

export function PlatformIcon({ meta }: { meta: PlatformMeta }) {
  const icons = {
    facebook: Facebook,
    instagram: Instagram,
    youtube: Youtube,
    twitter: Twitter,
    telegram: Send,
    other: Hash,
  };
  const Icon = icons[meta.key as keyof typeof icons];
  return (
    <span className={`social-mark ${meta.tone}`}>
      {meta.key === 'tiktok' ? <TikTokMark /> : meta.key === 'threads' ? <ThreadsMark /> : Icon ? <Icon size={18} /> : <Hash size={18} />}
    </span>
  );
}
