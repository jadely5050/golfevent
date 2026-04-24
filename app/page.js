'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function Dashboard() {
  const [recentRounds, setRecentRounds] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem('golf-rounds');
    if (saved) {
      setRecentRounds(JSON.parse(saved));
    } else {
      // Mock data for initial WOW factor
      setRecentRounds([
        { id: '1', date: '2026.04.20', course: '오거스타 내셔널', score: 72, par: 72, putts: 28 },
        { id: '2', date: '2026.04.15', course: '페블비치', score: 75, par: 72, putts: 31 }
      ]);
    }
  }, []);

  const avgScore = recentRounds.length ? Math.round(recentRounds.reduce((a, b) => a + b.score, 0) / recentRounds.length) : '-';
  const avgPutts = recentRounds.length ? Math.round(recentRounds.reduce((a, b) => a + b.putts, 0) / recentRounds.length) : '-';

  return (
    <div className="container" style={{ animation: 'fadeIn 0.5s ease-out' }}>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}} />
      
      <div className="stat-grid">
        <div className="stat-box">
          <div className="stat-value">{avgScore}</div>
          <div className="stat-label">평균 타수</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{avgPutts}</div>
          <div className="stat-label">평균 퍼팅 수</div>
        </div>
      </div>

      <Link href="/record" style={{ textDecoration: 'none' }}>
        <button className="btn btn-primary" style={{ marginBottom: '2rem' }}>
          + 새 라운드 시작
        </button>
      </Link>

      <h3>최근 라운드 기록</h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {recentRounds.map((round) => (
          <Link key={round.id} href={`/record?id=${round.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: 0, cursor: 'pointer' }}>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>{round.date}</div>
                <div style={{ fontWeight: '600', fontSize: '1.1rem' }}>{round.course}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: '800', color: round.score <= round.par ? 'var(--accent-neon)' : 'white' }}>
                   {round.score}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{round.putts} 퍼팅</div>
              </div>
            </div>
          </Link>
        ))}
        {recentRounds.length === 0 && (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <p>기록된 라운드가 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}
