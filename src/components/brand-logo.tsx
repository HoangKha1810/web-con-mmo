import Link from 'next/link';

export function BrandLogo({ href = '/dashboard' }: { href?: string }) {
  return (
    <Link className="brand-logo-link" href={href} aria-label="Hệ Thống Sub">
      <img
        className="brand-logo-image"
        src="/brand/hethongsub-logo-wide.png"
        alt="Hệ Thống Sub"
        width={1060}
        height={620}
      />
    </Link>
  );
}
