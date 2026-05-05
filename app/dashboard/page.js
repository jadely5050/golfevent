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

  // --- 데이터 가공 엔진 (v4) ---
  const processData = () => {
    const holes = round.holes.map(h => {
      const shots = h.shots || [];
      const par = h.par || 4;
      
      // 벌타 계산 로직 개선
      const penaltyValue = shots.reduce((acc, s, idx) => {
        if (s.penalty === 'H') return acc + 1;
        if (s.penalty === 'O') return (idx === 0) ? acc + 2 : acc + 1;
        return acc;
      }, 0);

      const score = shots.length + penaltyValue;
      const putts = shots.filter(s => s.club === 'Pt').length;
      
      // GIR 개선: par-2 타수 이내 온그린 + 온그린 전까지 벌타 없어야 함
      const onGreenIdx = shots.findIndex(s => s.landing === 'G' || s.landing === 'I' || s.landing === 'C');
      const reachedGreenIn = onGreenIdx + 1;
      const hasPenaltyBeforeGreen = onGreenIdx >= 0 && shots.slice(0, reachedGreenIn).some(s => s.penalty !== '-');
      const gir = (reachedGreenIn > 0) && (reachedGreenIn <= (par - 2)) && !hasPenaltyBeforeGreen;

      // F/W 개선: 첫 샷 벌타 시 X
      const fw = shots.length > 0 && shots[0].penalty === '-' && shots[0].landing === 'F';
      
      const teeClub = (shots.length > 0 && shots[0].club !== 'Pt') ? shots[0].club : '-';
      const sandShots = shots.filter(s => s.landing === 'B').length;
      
      const isTop = shots.some(s => s.memo?.includes('탑볼') || s.memo?.includes('탑'));
      const isDuff = shots.some(s => s.memo?.includes('뒷땅') || s.memo?.includes('더덕') || s.memo?.includes('뒷'));

      return { 
        ...h, 
        score, 
        net: score - par,
        putts, 
        gir, 
        fw, 
        teeClub, 
        sandShots, 
        penaltyValue,
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
        penalty: targetHoles.reduce((a, b) => a + b.penaltyValue, 0),
        sand: targetHoles.reduce((a, b) => a + b.sandShots, 0),
        fw: targetHoles.filter(h => h.fw).length,
        gir: targetHoles.filter(h => h.gir).length,
        birdies: targetHoles.filter(h => h.diff <= -1).length,
        pars: targetHoles.filter(h => h.diff === 0).length,
        bogeys: targetHoles.filter(h => h.diff === 1).length,
        threePutts: targetHoles.filter(h => h.putts >= 3).length,
        onePutts: targetHoles.filter(h => h.putts <= 1).length,
        tops: targetHoles.filter(h => h.isTop).length,
        duffs: targetHoles.filter(h => h.isDuff).length,
        maxDrive: dists.length > 0 ? Math.max(...dists) : 0
      };
    };

    return { 
      holes, 
      out: getStats(holes.slice(0, 9)),
      in: getStats(holes.slice(9, 18)),
      total: getStats(holes) 
    };
  };

  const data = processData();
  const selectedHole = data.holes.find(h => h.hole === selectedHoleNum) || data.holes[0];

  const getParColor = (par) => {
    if (par === 3) return '#38bdf8';
    if (par === 5) return '#f59e0b';
    return '#ffffff';
  };

  const metrics = [
    { name: 'Par', key: 'par', getColor: (h) => getParColor(h.par) },
    { name: 'Score', key: 'score', bold: true, getCellClass: (h) => (h.diff <= -1 ? 'bg-birdie' : h.diff === 0 ? 'bg-par' : h.diff === 1 ? 'bg-bogey' : 'bg-double') },
    { name: 'Net', key: 'net', format: (v) => (v > 0 ? `+${v}` : v), getColor: (h) => (h.net >= 2 ? '#ef4444' : 'inherit'), bold: (h) => h.net >= 2 },
    { name: 'HDCP', key: 'hdcp', value: '-' },
    { name: 'Putt', key: 'putts', getColor: (h) => (h.putts >= 3 ? '#ef4444' : 'inherit') },
    { name: 'T-Club', key: 'teeClub', color: 'var(--accent-neon)' },
    { name: 'F/W', key: 'fw', format: (v) => v ? 'O' : 'X' },
    { name: 'GIR', key: 'gir', format: (v) => v ? 'O' : 'X' },
    { name: 'Penalty', key: 'penaltyValue', format: (v) => v > 0 ? v : '-', color: '#ef4444' },
    { name: 'Sand', key: 'sandShots', format: (v) => v > 0 ? v : '-' },
    { name: 'Memo', key: 'memo', small: true }
  ];

  const renderMetricRow = (m) => {
    const outVal = data.out[m.key.replace('Value', '').replace('Shots', 'sand')] || '-';
    const inVal = data.in[m.key.replace('Value', '').replace('Shots', 'sand')] || '-';
    const totVal = data.total[m.key.replace('Value', '').replace('Shots', 'sand')] || '-';

    return (
      <tr key={m.name}>
        <td className="metric-name">{m.name}</td>
        {/* OUT (1-9) */}
        {data.holes.slice(0, 9).map(h => {
          const val = m.value !== undefined ? m.value : h[m.key];
          return (
            <td 
              key={h.hole} 
              className={`mono ${m.bold === true || (typeof m.bold === 'function' && m.bold(h)) ? 'bold' : ''} ${m.getCellClass ? m.getCellClass(h) : ''}`}
              style={{ 
                fontSize: m.small ? '0.65rem' : '0.9rem', 
                color: m.getColor ? m.getColor(h) : (m.color || 'inherit'),
                cursor: 'pointer',
                background: selectedHoleNum === h.hole ? 'rgba(16, 185, 129, 0.1)' : 'transparent'
              }}
              onClick={() => setSelectedHoleNum(h.hole)}
            >
              {m.format ? m.format(val) : val}
            </td>
          );
        })}
        <td className="mono bold subtotal">{(m.name === 'F/W' || m.name === 'GIR') ? data.out[m.key] : outVal}</td>
        
        {/* IN (10-18) */}
        {data.holes.slice(9, 18).map(h => {
          const val = m.value !== undefined ? m.value : h[m.key];
          return (
            <td 
              key={h.hole} 
              className={`mono ${m.bold === true || (typeof m.bold === 'function' && m.bold(h)) ? 'bold' : ''} ${m.getCellClass ? m.getCellClass(h) : ''}`}
              style={{ 
                fontSize: m.small ? '0.65rem' : '0.9rem', 
                color: m.getColor ? m.getColor(h) : (m.color || 'inherit'),
                cursor: 'pointer',
                background: selectedHoleNum === h.hole ? 'rgba(16, 185, 129, 0.1)' : 'transparent'
              }}
              onClick={() => setSelectedHoleNum(h.hole)}
            >
              {m.format ? m.format(val) : val}
            </td>
          );
        })}
        <td className="mono bold subtotal">{(m.name === 'F/W' || m.name === 'GIR') ? data.in[m.key] : inVal}</td>
        <td className="mono bold total-cell">{(m.name === 'F/W' || m.name === 'GIR') ? data.total[m.key] : totVal}</td>
      </tr>
    );
  };

  return (
    <div className="dashboard-container" style={{ animation: 'fadeIn 0.5s ease-out' }}>
      {/* 상단 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <Link href="/" style={{ textDecoration: 'none', color: 'var(--accent-neon)', fontWeight: 'bold' }}>← BACK</Link>
        <div style={{ textAlign: 'right' }}>
          <h1 style={{ margin: 0, fontSize: '2rem' }}>{round.course}</h1>
          <div style={{ color: 'var(--text-secondary)' }}>{round.date} | Score: {data.total.score} | Putts: {data.total.putts}</div>
        </div>
      </div>

      <div className="dashboard-layout">
        <div className="table-section">
          <div className="table-container" style={{ overflowX: 'auto' }}>
            <table className="transposed-table">
              <thead>
                <tr>
                  <th className="metric-name">HOLE</th>
                  {data.holes.slice(0, 9).map(h => (
                    <th key={h.hole} className={`hole-num ${selectedHoleNum === h.hole ? 'active' : ''}`} onClick={() => setSelectedHoleNum(h.hole)}>{h.hole}</th>
                  ))}
                  <th className="subtotal">OUT</th>
                  {data.holes.slice(9, 18).map(h => (
                    <th key={h.hole} className={`hole-num ${selectedHoleNum === h.hole ? 'active' : ''}`} onClick={() => setSelectedHoleNum(h.hole)}>{h.hole}</th>
                  ))}
                  <th className="subtotal">IN</th>
                  <th className="total-cell">TOT</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map(renderMetricRow)}
              </tbody>
            </table>
          </div>

          {/* 요약 카드 */}
          <div className="summary-grid" style={{ marginTop: '2rem' }}>
            <div className="summary-card">
              <h4>Score Dist</h4>
              <div className="summary-value" style={{ fontSize: '1.2rem' }}>B:{data.total.birdies} / P:{data.total.pars} / B:{data.total.bogeys}</div>
            </div>
            <div className="summary-card">
              <h4>Putting</h4>
              <div className="summary-value">{data.total.threePutts} <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>3-Putts</span></div>
              <div className="summary-subtext">1-Putt/Chip: {data.total.onePutts}</div>
            </div>
            <div className="summary-card">
              <h4>Shot Quality</h4>
              <div className="summary-value">{data.total.tops} / {data.total.duffs}</div>
              <div className="summary-subtext">Top / Duff (Memo based)</div>
            </div>
            <div className="summary-card">
              <h4>Max Drive</h4>
              <div className="summary-value">{data.total.maxDrive}m</div>
            </div>
          </div>
        </div>

        {/* 우측 상세 패널 */}
        <div className="detail-section">
          <div className="detail-panel">
            <h3 style={{ color: 'var(--accent-neon)', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between' }}>
              Hole {selectedHole.hole}
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Par {selectedHole.par}</span>
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {selectedHole.shots.map((s, idx) => (
                <div key={idx} className="shot-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div className="shot-card-header" style={{ margin: 0, minWidth: '45px' }}>#{idx + 1}</div>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{s.club} <span style={{ opacity: 0.6, fontWeight: 'normal', fontSize: '0.8rem' }}>({s.shotType})</span></div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>L: {s.landing} | {s.penalty !== '-' ? <span className="penalty-text">{s.penalty}</span> : 'No Penalty'}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="mono" style={{ fontSize: '1rem', color: 'var(--accent-neon)' }}>{s.fDis || s.tDis || '-'}m</div>
                    {s.memo && <div style={{ fontSize: '0.65rem', opacity: 0.6, maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.memo}</div>}
                  </div>
                </div>
              ))}
            </div>
            <div className="yardage-placeholder">
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem' }}>🗺️</div>
                <div style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>Yardage & Drawings</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .subtotal { background: rgba(56, 189, 248, 0.1) !important; color: #38bdf8 !important; font-weight: bold; }
        .total-cell { background: rgba(16, 185, 129, 0.1) !important; color: var(--accent-neon) !important; font-weight: 800; border-left: 2px solid var(--accent-neon) !important; }
        .bold { font-weight: bold; }
        .penalty-text { color: #ef4444 !important; font-weight: 800; }
        .transposed-table .metric-name { border-right: 2px solid var(--accent-neon); position: sticky; left: 0; z-index: 20; background: #0f172a; }
        .hole-num.active { background: var(--accent-neon) !important; color: black !important; }
      `}} />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="dashboard-container">Loading...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
