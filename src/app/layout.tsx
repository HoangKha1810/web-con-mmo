import type { Metadata } from 'next';
import './globals.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Hệ Thống Sub',
  description: 'Nền tảng đặt dịch vụ SMM và Auto MXH cho Facebook, TikTok, Instagram, YouTube.',
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
