import type { MetadataRoute } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://hethongsub.vn';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin/'],
    },
    sitemap: `${siteUrl.replace(/\/+$/, '')}/sitemap.xml`,
    host: siteUrl.replace(/^https?:\/\//, '').replace(/\/+$/, ''),
  };
}
