export type CatalogService = {
  id: number;
  source: 'smm' | 'automxh';
  display_name: string;
  category: string;
  platform: string;
  min_qty: number;
  max_qty: number;
  sale_price: number;
};

export type PlatformMeta = {
  key: string;
  label: string;
  mark: string;
  tone: string;
};

export type ServiceIntentMeta = {
  key: string;
  label: string;
  shortLabel: string;
  tone: string;
};

const platformMap: Record<string, PlatformMeta> = {
  facebook: { key: 'facebook', label: 'Facebook', mark: 'f', tone: 'blue' },
  instagram: { key: 'instagram', label: 'Instagram', mark: 'IG', tone: 'pink' },
  tiktok: { key: 'tiktok', label: 'TikTok', mark: 'TT', tone: 'tiktok' },
  youtube: { key: 'youtube', label: 'YouTube', mark: 'YT', tone: 'red' },
  threads: { key: 'threads', label: 'Threads', mark: '@', tone: 'threads' },
  twitter: { key: 'twitter', label: 'X / Twitter', mark: 'X', tone: 'dark' },
  x: { key: 'twitter', label: 'X / Twitter', mark: 'X', tone: 'dark' },
  telegram: { key: 'telegram', label: 'Telegram', mark: 'TG', tone: 'cyan' },
  zalo: { key: 'zalo', label: 'Zalo', mark: 'Z', tone: 'blue' },
};

export function normalizeCatalogText(value: string) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const serviceIntentRules: Array<ServiceIntentMeta & { patterns: string[] }> = [
  {
    key: 'live',
    label: 'Mắt live / Livestream',
    shortLabel: 'Live',
    tone: 'cyan',
    patterns: ['live', 'livestream', 'stream', 'phat truc tiep', 'mat live', 'mat xem'],
  },
  {
    key: 'comment',
    label: 'Bình luận / Comment',
    shortLabel: 'Comment',
    tone: 'blue',
    patterns: ['comment', 'comments', 'cmt', 'coment', 'binh luan', 'binh luan facebook', 'binh luan tiktok'],
  },
  {
    key: 'like',
    label: 'Like / Cảm xúc',
    shortLabel: 'Like',
    tone: 'pink',
    patterns: ['like', 'likes', 'tim', 'cam xuc', 'reaction', 'react', 'haha', 'wow', 'thuong thuong', 'love'],
  },
  {
    key: 'follow',
    label: 'Theo dõi / Follow',
    shortLabel: 'Follow',
    tone: 'green',
    patterns: ['follow', 'follower', 'followers', 'sub ', 'subscriber', 'subscribe', 'theo doi', 'tang theo doi'],
  },
  {
    key: 'view',
    label: 'View / Lượt xem',
    shortLabel: 'View',
    tone: 'cyan',
    patterns: ['view', 'views', 'luot xem', 'xem video', 'story', 'reels', 'video', 'play', 'plays', 'traffic'],
  },
  {
    key: 'share',
    label: 'Chia sẻ / Share',
    shortLabel: 'Share',
    tone: 'blue',
    patterns: ['share', 'shares', 'chia se'],
  },
  {
    key: 'member',
    label: 'Thành viên / Group',
    shortLabel: 'Member',
    tone: 'green',
    patterns: ['member', 'members', 'thanh vien', 'group', 'nhom'],
  },
  {
    key: 'review',
    label: 'Đánh giá / Review',
    shortLabel: 'Review',
    tone: 'amber',
    patterns: ['review', 'reviews', 'danh gia', 'google map'],
  },
  {
    key: 'save',
    label: 'Lưu / Save',
    shortLabel: 'Save',
    tone: 'dark',
    patterns: ['save', 'saves', 'luu bai', 'bookmark'],
  },
];

export function cleanServiceCategory(value: string) {
  return String(value || 'Dịch vụ phổ biến')
    .replace(/\[[^\]]+\]/g, '')
    .replace(/\s+/g, ' ')
    .trim() || 'Dịch vụ phổ biến';
}

export function getPlatformMeta(service: CatalogService): PlatformMeta {
  const raw = `${service.platform || ''} ${service.category || ''} ${service.display_name || ''}`;
  const normalized = normalizeCatalogText(raw);
  const found = Object.keys(platformMap).find((key) => normalized.includes(key));
  if (found) return platformMap[found];
  return { key: 'other', label: 'Khác', mark: '#', tone: 'green' };
}

export function getServiceIntentMeta(service: CatalogService): ServiceIntentMeta {
  const raw = `${service.category || ''} ${service.display_name || ''} ${service.platform || ''}`;
  const normalized = ` ${normalizeCatalogText(raw)} `;
  const found = serviceIntentRules.find((rule) => rule.patterns.some((pattern) => normalized.includes(` ${normalizeCatalogText(pattern)} `) || normalized.includes(normalizeCatalogText(pattern))));
  if (found) {
    const { patterns: _patterns, ...meta } = found;
    return meta;
  }
  return { key: 'other', label: 'Dịch vụ khác', shortLabel: 'Khác', tone: 'dark' };
}

export function serviceFamily(service: CatalogService) {
  if (service.source === 'automxh' && service.display_name.includes(' - ')) {
    return service.display_name.split(' - ')[0].trim();
  }
  return cleanServiceCategory(service.category);
}

export function serviceShortName(service: CatalogService) {
  if (service.source === 'automxh' && service.display_name.includes(' - ')) {
    return service.display_name.split(' - ').slice(1).join(' - ').trim() || service.display_name;
  }
  return service.display_name;
}

export function serviceUnitLabel(service: CatalogService) {
  return service.source === 'smm' ? '/ 1.000 lượt' : '/ gói';
}
