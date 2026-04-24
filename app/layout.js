import './globals.css';
import Link from 'next/link';

export const metadata = {
  title: 'Golf Tracker PRO',
  description: 'Premium golf round and shot tracker',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>
        <nav className="navbar">
          <Link href="/" className="navbar-brand">
            GOLF PRO
          </Link>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <Link href="/record" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: '500' }}>
              새 라운드
            </Link>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
