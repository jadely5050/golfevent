import './globals.css';
import Script from 'next/script';

export const metadata = {
  title: 'Golf Tracker PRO',
  description: 'Premium golf round and shot tracker',
};

export default function RootLayout({ children }) {
  const kakaoKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;
  return (
    <html lang="ko">
      <body>
        {kakaoKey && (
          <Script
            src={`//dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoKey}&autoload=false`}
            strategy="afterInteractive"
          />
        )}
        {children}
      </body>
    </html>
  );
}
