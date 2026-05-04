'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function DashboardContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const [round, setRound] = useState(null);
  const [selectedHoleNum, setSelectedHoleNum] = useState(1);

  useEffect(() => {
    // 스크롤 허용 클래스 추가
    document.body.classList.add('allow-scroll');
    
    if (id) {
      const saved = localStorage.getItem('golf-rounds');
      if (saved) {
        const parsed = JSON.parse(saved);
        const found = parsed.find(r => r.id === id);
        if (found) setRound(found);
      }
    }

    return () => {
      document.body.classList.remove('allow-scroll');
    };
  }, [id]);

  if (!round) {
    return (
      <div className="dashboard-container" style={{ textAlign: 'center', paddingTop: '10rem' }}>
        <p>데이터를 불러올 수 없습니다.</p>
        <Link href="/" className="btn btn-secondary" style={{ width: 'auto', marginTop: '1rem' }}>홈으로 이동</Link>
      </div>
    );
  }

  // --- 데이터 가공 엔진 ---
  const processData = () => {
    const holes = round.holes.map(h => {
      const shots = h.shots || [];
      const par = h.par || 4;
      
      const score = shots.length + shots.reduce((acc, s, idx) => {
        let penalty = 0;
        if (s.penalty === 'O') penalty = (par >= 4 && idx === 0) ? 2 : 1;
        else if (s.penalty === 'H') penalty = 1;
        return acc + penalty;
      }, 0);

      const putts = shots.filter(s => s.club === 'Pt').length;
      const gir = (shots.length - putts) <= (par - 2);
      const fw = shots.length > 0 && shots[0].club !== 'Pt' && shots[0].landing === 'F';
      const teeClub = (shots.length > 0 && shots[0].club !== 'Pt') ? shots[0].club : '-';
      const sandShots = shots.filter(s => s.landing === 'B').length;
      const penaltyType = shots.find(s => s.penalty !== '-') ? shots.find(s => s.penalty !== '-').penalty : '-';
      
      const isTop = shots.some(s => s.memo?.includes('탑볼') || s.memo?.includes('탑'));
      const isDuff = shots.some(s => s.memo?.includes('뒷땅') || s.memo?.includes('더덕') || s.memo?.includes('뒷'));

      return { 
        ...h, 
        score, 
        putts, 
        gir, 
        fw, 
        teeClub, 
        sandShots, 
        penaltyType,
        isTop,
        isDuff,
        diff: score - par
      };
    });

    const getStats = (targetHoles) => {
      const dists = targetHoles.flatMap(h => h.shots || [])
        .filter(s => s.club === 'W1' && s.fDis)
        .map(s => parseInt(s.fDis));
      
      return {
        score: targetHoles.reduce((a, b) => a + b.score, 0),
        par: targetHoles.reduce((a, b) => a + b.par, 0),
        putts: targetHoles.reduce((a, b) => a + b.putts, 0),
        birdies: targetHoles.filter(h => h.diff <= -1).length,
        pars: targetHoles.filter(h => h.diff === 0).length,
        bogeys: targetHoles.filter(h => h.diff === 1).length,
        dbogeys: targetHoles.filter(h => h.diff === 2).length,
        tbogeys: targetHoles.filter(h => h.diff === 3).length,
        doublePars: targetHoles.filter(h => h.diff >= targetHoles[0]?.par).length,
        threePutts: targetHoles.filter(h => h.putts >= 3).length,
        onePutts: targetHoles.filter(h => h.putts <= 1).length,
        tops: targetHoles.filter(h => h.isTop).length,
        duffs: targetHoles.filter(h => h.isDuff).length,
        maxDrive: dists.length > 0 ? Math.max(...dists) : 0
      };
    };

    return { 
      holes, 
      total: getStats(holes) 
    };
  };

  const data = processData();
  const selectedHole = data.holes.find(h => h.hole === selectedHoleNum) || data.holes[0];

  const getCellClass = (diff) => {
    if (diff <= -1) return 'bg-birdie';
    if (diff === 0) return 'bg-par';
    if (diff === 1) return 'bg-bogey';
    return 'bg-double';
  };

  const metrics = [
    { name: 'Par', key: 'par' },
    { name: 'Score', key: 'score', bold: true },
    { name: 'Net', key: 'score' }, // 우선 Score와 동일
    { name: 'HDCP', key: 'hdcp', value: '-' },
    { name: 'Putt', key: 'putts' },
    { name: 'T-Club', key: 'teeClub', color: 'var(--accent-neon)' },
    { name: 'F/W', key: 'fw', format: (v) => v ? 'O' : 'X' },
    { name: 'GIR', key: 'gir', format: (v) => v ? 'O' : 'X' },
    { name: 'Penalty', key: 'penaltyType', penalty: true },
    { name: 'Sand', key: 'sandShots', format: (v) => v > 0 ? v : '-' },
    { name: 'Memo', key: 'memo', small: true }
  ];

  return (
    <div className="dashboard-container" style={{ animation: 'fadeIn 0.5s ease-out' }}>
      {/* --- 상단 헤더 & 요약 --- */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <Link href="/" style={{ textDecoration: 'none', color: 'var(--accent-neon)', fontWeight: 'bold' }}>← BACK TO HOME</Link>
        <div style={{ textAlign: 'right' }}>
          <h1 style={{ margin: 0, fontSize: '2rem' }}>{round.course}</h1>
          <div style={{ color: 'var(--text-secondary)' }}>{round.date} | Score: {data.total.score} | Putts: {data.total.putts}</div>
        </div>
      </div>

      <div className="summary-grid">
        <div className="summary-card">
          <h4>Score Dist</h4>
          <div className="summary-value" style={{ fontSize: '1.2rem' }}>B:{data.total.birdies} / P:{data.total.pars} / B:{data.total.bogeys}</div>
          <div className="summary-subtext">Others: {data.total.dbogeys + data.total.tbogeys + data.total.doublePars}</div>
        </div>
        <div className="summary-card">
          <h4>Putting</h4>
          <div className="summary-value">{data.total.threePutts} <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>3-Putts</span></div>
          <div className="summary-subtext">1-Putt/Chip: {data.total.onePutts}</div>
        </div>
        <div className="summary-card">
          <h4>Shot Quality</h4>
          <div className="summary-value">{data.total.tops} / {data.total.duffs}</div>
          <div className="summary-subtext">Top / Duff</div>
        </div>
        <div className="summary-card">
          <h4>Max Drive</h4>
          <div className="summary-value">{data.total.maxDrive}m</div>
        </div>
      </div>

      {/* --- 2컬럼 레이아웃 --- */}
      <div className="dashboard-layout">
        
        {/* 좌측: 가로 성적표 테이블 */}
        <div className="table-section">
          <div className="table-container" style={{ overflowX: 'auto' }}>
            <table className="transposed-table">
              <thead>
                <tr>
                  <th className="metric-name">HOLE</th>
                  {data.holes.map(h => (
                    <th 
                      key={h.hole} 
                      className={`hole-num ${selectedHoleNum === h.hole ? 'active' : ''}`}
                      onClick={() => setSelectedHoleNum(h.hole)}
                      style={{ cursor: 'pointer', borderBottom: selectedHoleNum === h.hole ? '4px solid var(--accent-neon)' : 'none' }}
                    >
                      {h.hole}
                    </th>
                  ))}
                  <th className="hole-num">TOT</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map(m => (
                  <tr key={m.name}>
                    <td className="metric-name">{m.name}</td>
                    {data.holes.map(h => {
                      const val = m.value !== undefined ? m.value : h[m.key];
                      const formatted = m.format ? m.format(val) : val;
                      return (
                        <td 
                          key={h.hole} 
                          className={`mono ${m.bold ? 'bold' : ''} ${m.name === 'Score' ? getCellClass(h.diff) : ''} ${m.penalty && val !== '-' ? 'penalty-text' : ''}`}
                          style={{ 
                            fontSize: m.small ? '0.65rem' : '0.9rem', 
                            color: m.color || 'inherit',
                            opacity: m.small ? 0.7 : 1,
                            cursor: 'pointer',
                            background: selectedHoleNum === h.hole ? 'rgba(16, 185, 129, 0.05)' : 'transparent'
                          }}
                          onClick={() => setSelectedHoleNum(h.hole)}
                        >
                          {formatted}
                        </td>
                      );
                    })}
                    <td className="mono bold" style={{ background: 'rgba(255,255,255,0.05)' }}>
                      {m.name === 'Par' ? data.total.par : m.name === 'Score' ? data.total.score : m.name === 'Putt' ? data.total.putts : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 우측: 상세 정보 패널 */}
        <div className="detail-section">
          <div className="detail-panel">
            <h3 style={{ color: 'var(--accent-neon)', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between' }}>
              Hole {selectedHole.hole} Details
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Par {selectedHole.par}</span>
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {selectedHole.shots.map((s, idx) => (
                <div key={idx} className="shot-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div className="shot-card-header">SHOT {idx + 1}</div>
                    <div style={{ fontWeight: 'bold' }}>{s.club} <span style={{ opacity: 0.6, fontWeight: 'normal' }}>({s.shotType})</span></div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Landing: {s.landing}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="mono" style={{ fontSize: '1.1rem' }}>{s.fDis || s.tDis || '-'}m</div>
                    {s.penalty !== '-' && <div className="penalty-text" style={{ fontSize: '0.7rem' }}>{s.penalty}</div>}
                  </div>
                </div>
              ))}
              {selectedHole.shots.length === 0 && <p style={{ opacity: 0.5, textAlign: 'center' }}>기록된 샷이 없습니다.</p>}
            </div>

            {/* 향후 야디지 및 드로잉을 위한 공간 */}
            <div className="yardage-placeholder">
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem' }}>🗺️</div>
                <div style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>Yardage View Coming Soon</div>
                <div style={{ fontSize: '0.7rem', opacity: 0.5 }}>(Future Integration for Drawings)</div>
              </div>
            </div>
          </div>
        </div>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .bold { font-weight: bold; }
        .transposed-table .metric-name { border-right: 2px solid var(--accent-neon); }
        .hole-num.active { background: var(--accent-neon) !important; color: black !important; }
      `}} />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="dashboard-container" style={{ textAlign: 'center', paddingTop: '10rem' }}>Loading Dashboard...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
