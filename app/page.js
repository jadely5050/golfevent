'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const AUTH_KEY = 'gt-auth';
const PASSWORD = '19391939';

export default function Home() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');

  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setAuthed(sessionStorage.getItem(AUTH_KEY) === '1');
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (!authed) return;
    setLoading(true);
    setLoadError('');
    fetch('/api/events')
      .then(res => {
        if (!res.ok) throw new Error('목록을 불러오지 못했습니다.');
        return res.json();
      })
      .then(data => setPages(Array.isArray(data) ? data : []))
      .catch(err => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, [authed]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (pw === PASSWORD) {
      sessionStorage.setItem(AUTH_KEY, '1');
      setAuthed(true);
      setError('');
      setPw('');
    } else {
      setError('암호가 올바르지 않습니다.');
      setPw('');
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem(AUTH_KEY);
    setAuthed(false);
  };

  const formatDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const weekday = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
    return `${y}.${m}.${day} (${weekday})`;
  };

  if (checking) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-color)' }}>
        <div style={{ fontSize: '2rem' }}>⛳</div>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', animation: 'fadeIn 0.4s ease-out' }}>
        <style dangerouslySetInnerHTML={{ __html: `@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }` }} />
        <div className="glass-panel" style={{ width: '100%', maxWidth: 360, padding: '2rem 1.5rem', margin: 0 }}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.25rem' }}>⛳</div>
            <h2 style={{ margin: 0, color: 'var(--accent-neon)' }}>Golf Tracker</h2>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>암호를 입력하세요</div>
          </div>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              autoFocus
              value={pw}
              onChange={e => { setPw(e.target.value); if (error) setError(''); }}
              placeholder="••••••••"
              style={{
                width: '100%', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--glass-border)',
                borderRadius: '8px', padding: '0.75rem 0.9rem', color: 'white', fontSize: '1rem',
                letterSpacing: '0.2em', textAlign: 'center',
              }}
            />
            {error && <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '0.5rem', textAlign: 'center' }}>{error}</div>}
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
              로그인
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ animation: 'fadeIn 0.4s ease-out', position: 'relative' }}>
      <style dangerouslySetInnerHTML={{ __html: `@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }` }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h2 style={{ margin: 0, color: 'var(--accent-neon)' }}>⛳ Golf Tracker</h2>
        <button
          onClick={handleLogout}
          style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', borderRadius: '8px', padding: '0.35rem 0.7rem', fontSize: '0.75rem', cursor: 'pointer' }}
        >
          로그아웃
        </button>
      </div>

      <Link href="/generate" style={{ textDecoration: 'none' }}>
        <button className="btn btn-primary" style={{ width: '100%', marginBottom: '1.5rem' }}>
          + 페이지 생성하기
        </button>
      </Link>

      <h3 style={{ marginBottom: '0.75rem' }}>생성된 페이지 목록</h3>

      {loading && (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-secondary)' }}>
          불러오는 중...
        </div>
      )}

      {loadError && !loading && (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '2rem 1rem', color: '#ef4444' }}>
          {loadError}
        </div>
      )}

      {!loading && !loadError && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {pages.map((p) => (
            <Link key={p.slug} href={`/go/${encodeURIComponent(p.slug)}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: 0, cursor: 'pointer' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                    {formatDate(p.event_date) || formatDate(p.created_at)}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.title || '무제'}
                  </div>
                  {(p.subtitle || p.course_name) && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.subtitle || p.course_name}
                    </div>
                  )}
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.2rem', opacity: 0.7 }}>
                    /go/{p.slug}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', marginLeft: '0.5rem' }}>
                  <Link
                    href={`/generate?edit=${encodeURIComponent(p.slug)}`}
                    onClick={e => e.stopPropagation()}
                    style={{ textDecoration: 'none' }}
                  >
                    <button
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.4rem 0.6rem', cursor: 'pointer', color: 'white', fontSize: '0.75rem' }}
                      title="수정"
                    >
                      ✏️
                    </button>
                  </Link>
                </div>
              </div>
            </Link>
          ))}
          {pages.length === 0 && (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
              아직 생성된 페이지가 없습니다.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
