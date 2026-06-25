import type { Metadata } from 'next';
import './globals.css';

export const dynamic = 'force-dynamic';

const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://hethongsub.vn');
const siteName = 'Hệ Thống Sub';
const siteDescription = 'Nền tảng đặt dịch vụ SMM và Auto MXH cho Facebook, TikTok, Instagram, YouTube với bảng giá rõ ràng, ví riêng và lịch sử đơn minh bạch.';

export const metadata: Metadata = {
  metadataBase: siteUrl,
  applicationName: siteName,
  title: {
    default: `${siteName} - Dịch vụ SMM và Auto MXH`,
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  keywords: [
    'hethongsub',
    'hệ thống sub',
    'dịch vụ smm',
    'auto mxh',
    'tăng tương tác',
    'facebook',
    'tiktok',
    'instagram',
    'youtube',
  ],
  authors: [{ name: siteName, url: siteUrl.toString() }],
  creator: siteName,
  publisher: siteName,
  category: 'technology',
  alternates: {
    canonical: '/',
  },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-icon.png', sizes: '512x512', type: 'image/png' }],
  },
  manifest: '/manifest.webmanifest',
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    url: '/',
    siteName,
    title: `${siteName} - Dịch vụ SMM và Auto MXH`,
    description: siteDescription,
    images: [
      {
        url: '/brand/hethongsub-og.png',
        width: 1200,
        height: 630,
        alt: siteName,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${siteName} - Dịch vụ SMM và Auto MXH`,
    description: siteDescription,
    images: ['/brand/hethongsub-og.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" data-theme="dark" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('hss-theme')||(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme='dark';}`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
