import type { MetadataRoute } from 'next';

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://hethongsub.vn').replace(/\/+$/, '');

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes = [
    { path: '/', priority: 1 },
    { path: '/auth/login', priority: 0.7 },
    { path: '/auth/register', priority: 0.7 },
    { path: '/dashboard', priority: 0.8 },
    { path: '/services/smm', priority: 0.9 },
    { path: '/services/automxh', priority: 0.9 },
    { path: '/api-docs', priority: 0.5 },
  ];

  return routes.map((route) => ({
    url: `${siteUrl}${route.path}`,
    lastModified: now,
    changeFrequency: 'daily',
    priority: route.priority,
  }));
}
