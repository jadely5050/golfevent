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
        {children}
      </body>
    </html>
  );
}
