'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function DashboardContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const isCloud = searchParams.get('cloud') === 'true';
  const [round, setRound] = useState(null);
  const [selectedHoleNum, setSelectedHoleNum] = useState(1);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(isCloud);

  useEffect(() => {
    document.body.classList.add('allow-scroll');
    if (id) {
      if (isCloud) {
        setIsLoading(true);
        fetch('/api/rounds')
          .then(res => res.json())
          .then(data => {
            if (Array.isArray(data)) {
              const found = data.find(r => r.id === id);
              if (found) setRound(found);
            }
          })
          .catch(err => console.error('Cloud fetch error:', err))
          .finally(() => setIsLoading(false));
      } else {
        const saved = localStorage.getItem('golf-rounds');
        if (saved) {
          const parsed = JSON.parse(saved);
          const found = parsed.find(r => r.id === id);
          if (found) setRound(found);
        }
      }
    }
    return () => {
      document.body.classList.remove('allow-scroll');
    };
  }, [id, isCloud]);

  if (isLoading) {
    return (
      <div className="dashboard-container" style={{ textAlign: 'center', paddingTop: '10rem' }}>
        <p>데이터를 불러오는 중...</p>
      </div>
    );
  }

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
      const topCount = shots.filter(s => s.shotType === 'T').length;
      const duffCount = shots.filter(s => s.shotType === 'D').length;

      const hasMemo = shots.some(s => s.memo && s.memo.trim() !== '');

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
        topCount,
        duffCount,
        hasMemo,
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
        doubleBogeys: targetHoles.filter(h => h.diff === 2).length,
        triplePlus: targetHoles.filter(h => h.diff >= 3 && h.score < h.par * 2).length,
        doublePars: targetHoles.filter(h => h.score >= h.par * 2).length,
        threePutts: targetHoles.filter(h => h.putts >= 3).length,
        onePutts: targetHoles.filter(h => h.putts <= 1).length,
        tops: targetHoles.reduce((a, b) => a + b.topCount, 0),
        duffs: targetHoles.reduce((a, b) => a + b.duffCount, 0),
        memo: targetHoles.filter(h => h.hasMemo).length,
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
    { name: 'Memo', key: 'hasMemo', format: (v) => v ? 'o' : '-', small: true }
  ];

  const renderMetricRow = (m) => {
    const outVal = data.out[m.key.replace('Value', '').replace('Shots', 'sand').replace('hasMemo', 'memo')] || '-';
    const inVal = data.in[m.key.replace('Value', '').replace('Shots', 'sand').replace('hasMemo', 'memo')] || '-';
    const totVal = data.total[m.key.replace('Value', '').replace('Shots', 'sand').replace('hasMemo', 'memo')] || '-';

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
                onClick={() => {
                  setSelectedHoleNum(h.hole);
                  // PC에서도 모달을 띄우고 싶다면 주석 해제 (현재는 모바일만 요청됨)
                  // setIsDetailModalOpen(true);
                }}
            >
              {m.format ? m.format(val) : val}
            </td>
          );
        })}
        <td className="mono bold subtotal">{(m.name === 'F/W' || m.name === 'GIR' || m.name === 'Memo') ? outVal : outVal}</td>

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
                onClick={() => {
                  setSelectedHoleNum(h.hole);
                  // PC에서도 모달을 띄우고 싶다면 주석 해제
                  // setIsDetailModalOpen(true);
                }}
            >
              {m.format ? m.format(val) : val}
            </td>
          );
        })}
        <td className="mono bold subtotal">{(m.name === 'F/W' || m.name === 'GIR' || m.name === 'Memo') ? inVal : inVal}</td>
        <td className="mono bold total-cell">{(m.name === 'F/W' || m.name === 'GIR' || m.name === 'Memo') ? totVal : totVal}</td>
      </tr>
    );
  };

  const MobileHoleTable = ({ holesBlock }) => {
    const hiddenMetrics = ['T-Club', 'HDCP', 'F/W', 'GIR', 'Memo'];
    const filteredMetrics = metrics.filter(m => !hiddenMetrics.includes(m.name));

    return (
      <div className="mobile-hole-table-container">
        <table className="mobile-hole-table">
          <thead>
            <tr>
              <th>HOLE</th>
              {holesBlock.map(h => (
                <th key={h.hole} className={`hole-header ${selectedHoleNum === h.hole ? 'active-hole' : ''}`} onClick={() => {
                  setSelectedHoleNum(h.hole);
                  setIsDetailModalOpen(true);
                }}>
                  {h.hole}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredMetrics.map(m => (
              <tr key={m.name}>
                <td style={{ textAlign: 'left', paddingLeft: '0.5rem', fontWeight: 'bold', color: 'var(--text-secondary)', fontSize: '0.7rem' }}>{m.name}</td>
                {holesBlock.map(h => {
                  const val = m.value !== undefined ? m.value : h[m.key];
                  return (
                    <td
                      key={h.hole}
                      className={`mono ${m.getCellClass ? m.getCellClass(h) : ''} ${selectedHoleNum === h.hole ? 'active-hole' : ''}`}
                      style={{
                        color: m.getColor ? m.getColor(h) : (m.color || 'inherit'),
                        fontWeight: m.bold === true || (typeof m.bold === 'function' && m.bold(h)) ? 'bold' : 'normal'
                      }}
                      onClick={() => {
                      setSelectedHoleNum(h.hole);
                      setIsDetailModalOpen(true);
                    }}
                    >
                      {m.format ? m.format(val) : val}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="dashboard-container" style={{ animation: 'fadeIn 0.5s ease-out' }}>
      
      {/* PC VIEW */}
      <div className="pc-only">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingTop: '1rem' }}>
          <Link href="/" style={{ textDecoration: 'none', color: 'var(--accent-neon)', fontWeight: 'bold', fontSize: '0.9rem' }}>← BACK</Link>
          <div style={{ textAlign: 'right' }}>
            <h1 style={{ margin: 0, fontSize: '1.2rem' }}>{round.course}</h1>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{round.date} | Score: {data.total.score} | Putts: {data.total.putts}</div>
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
                      <th key={h.hole} className={`hole-num ${selectedHoleNum === h.hole ? 'active' : ''}`} onClick={() => {
                        setSelectedHoleNum(h.hole);
                      }}>{h.hole}</th>
                    ))}
                    <th className="subtotal">OUT</th>
                    {data.holes.slice(9, 18).map(h => (
                      <th key={h.hole} className={`hole-num ${selectedHoleNum === h.hole ? 'active' : ''}`} onClick={() => {
                        setSelectedHoleNum(h.hole);
                      }}>{h.hole}</th>
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

            {/* 요약 카드 (PC) */}
            <div className="summary-grid" style={{ marginTop: '2rem' }}>
              <div className="summary-card">
                <h4>Score Dist</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', fontSize: '0.9rem' }}>
                  <div>버디 : <span style={{ color: 'var(--accent-neon)' }}>{data.total.birdies}</span></div>
                  <div>파 : <span style={{ color: 'var(--accent-neon)' }}>{data.total.pars}</span></div>
                  <div>보기 : <span style={{ color: 'white' }}>{data.total.bogeys}</span></div>
                  <div>더보 : <span style={{ color: 'white' }}>{data.total.doubleBogeys}</span></div>
                  <div>3플보기 : <span style={{ color: 'white' }}>{data.total.triplePlus}</span></div>
                  <div>양파 : <span style={{ color: 'var(--danger)' }}>{data.total.doublePars}</span></div>
                </div>
              </div>
              <div className="summary-card">
                <h4>Putting</h4>
                <div className="summary-value">{data.total.threePutts} <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>3-Putts</span></div>
                <div className="summary-subtext">1-Putt/Chip: {data.total.onePutts}</div>
              </div>
              <div className="summary-card">
                <h4>Shot Quality</h4>
                <div className="summary-value">{data.total.tops} / {data.total.duffs}</div>
                <div className="summary-subtext">Top / Duff (T/D logic)</div>
              </div>
              <div className="summary-card">
                <h4>Max Drive</h4>
                <div className="summary-value">{data.total.maxDrive}m</div>
              </div>
            </div>
          </div>

          {/* 우측 상세 패널 (PC) */}
          <div className="detail-section">
            <div className="detail-panel">
              <h3 style={{ color: 'var(--accent-neon)', marginBottom: '1.2rem', display: 'flex', justifyContent: 'space-between' }}>
                Hole {selectedHole.hole}
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Par {selectedHole.par}</span>
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {selectedHole.shots.map((s, idx) => (
                  <div key={idx} className="shot-card" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.5rem', fontSize: '0.75rem', overflow: 'hidden' }}>
                    <div className="shot-card-header" style={{ margin: 0, minWidth: '22px', color: 'var(--accent-neon)' }}>#{idx + 1}</div>
                    <div style={{ fontWeight: 'bold', minWidth: '32px' }}>{s.club}</div>
                    <div style={{ opacity: 0.6, minWidth: '45px', whiteSpace: 'nowrap' }}>{s.shotType}</div>
                    <div style={{ color: 'var(--text-secondary)', minWidth: '18px', textAlign: 'center' }}>{s.landing}</div>
                    <div style={{ minWidth: '18px', textAlign: 'center', opacity: 0.8 }}>{s.distanceCtrl || ''}</div>
                    <div style={{ minWidth: '22px', textAlign: 'center' }}>
                      {(s.penalty === 'H' || s.penalty === 'O') ? <span className="penalty-text" style={{ fontSize: '0.65rem' }}>{s.penalty}</span> : ''}
                    </div>
                    <div className="mono" style={{ color: 'var(--accent-neon)', minWidth: '70px', textAlign: 'right', fontSize: '0.7rem' }}>
                      {s.tDis || '-'}/{s.fDis || '-'}m
                    </div>
                    {s.memo && <div style={{ fontSize: '0.65rem', opacity: 0.5, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginLeft: '0.3rem' }}>{s.memo}</div>}
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
      </div>

      {/* MOBILE VIEW */}
      <div className="mobile-only">
        <div className="mobile-header">
          <Link href="/" style={{ textDecoration: 'none', color: 'var(--accent-neon)', fontWeight: 'bold', fontSize: '0.8rem' }}>← BACK</Link>
          <h1 style={{ marginTop: '0.5rem' }}>{round.course}</h1>
          <div className="round-meta">
            {round.date} | <span style={{ color: 'var(--accent-neon)' }}>Score: {data.total.score}</span> | Putts: {data.total.putts}
          </div>
        </div>

        {/* 요약 카드 (Mobile) */}
        <div className="mobile-summary-grid">
          <div className="mobile-summary-card">
            <h4>Score Dist</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.2rem', fontSize: '0.7rem' }}>
              <div>버디:{data.total.birdies}</div>
              <div>파:{data.total.pars}</div>
              <div>보기:{data.total.bogeys}</div>
              <div>더보:{data.total.doubleBogeys}</div>
              <div>3플:{data.total.triplePlus}</div>
              <div>양파:{data.total.doublePars}</div>
            </div>
          </div>
          <div className="mobile-summary-card">
            <h4>Putting</h4>
            <div className="mobile-summary-value">{data.total.putts} <span style={{ fontSize: '0.7rem' }}>({data.total.threePutts} 3-Pts)</span></div>
          </div>
          <div className="mobile-summary-card">
            <h4>Shot Quality</h4>
            <div className="mobile-summary-value">{data.total.tops}T / {data.total.duffs}D</div>
          </div>
          <div className="mobile-summary-card">
            <h4>Max Drive</h4>
            <div className="mobile-summary-value">{data.total.maxDrive}m</div>
          </div>
        </div>

        {/* 홀별 데이터 (Mobile) */}
        <MobileHoleTable holesBlock={data.holes.slice(0, 9)} />
        <MobileHoleTable holesBlock={data.holes.slice(9, 18)} />

        {/* 홀 상세 모달 (Mobile) */}
        {isDetailModalOpen && (
          <div className="modal-overlay" onClick={() => setIsDetailModalOpen(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ border: '1px solid var(--accent-neon)', position: 'relative' }}>
              <button 
                onClick={() => setIsDetailModalOpen(false)}
                style={{
                  position: 'absolute',
                  top: '1rem',
                  right: '1rem',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  zIndex: 10
                }}
              >
                ×
              </button>
              
              <h3 style={{ color: 'var(--accent-neon)', fontSize: '1.1rem', marginBottom: '1.2rem', paddingRight: '2rem' }}>
                Hole {selectedHole.hole} (Par {selectedHole.par}) 상세
              </h3>
              
              <div className="mobile-shot-list" style={{ maxHeight: '40vh', overflowY: 'auto' }}>
                {selectedHole.shots.map((s, idx) => (
                  <div key={idx} className="mobile-shot-card" style={{ marginBottom: '0.5rem' }}>
                    <div style={{ color: 'var(--accent-neon)', width: '1.2rem', fontWeight: 'bold' }}>{idx + 1}</div>
                    <div style={{ fontWeight: 'bold', width: '1.8rem' }}>{s.club}</div>
                    <div style={{ color: 'var(--text-secondary)', flex: 1, fontSize: '0.75rem' }}>{s.shotType} {s.landing}</div>
                    <div className="mono" style={{ color: 'var(--accent-neon)', fontSize: '0.8rem' }}>{s.fDis || s.tDis || '-'}m</div>
                    {s.penalty !== '-' && <div className="penalty-text" style={{ marginLeft: '0.4rem', fontSize: '0.7rem' }}>{s.penalty}</div>}
                  </div>
                ))}
              </div>
              
              <div className="yardage-placeholder" style={{ aspectRatio: '1/1', marginTop: '1rem', height: '200px', margin: '1rem auto' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem' }}>🗺️</div>
                  <div style={{ fontSize: '0.7rem', marginTop: '0.5rem' }}>Yardage & Drawing</div>
                </div>
              </div>

              <button 
                className="btn btn-primary" 
                style={{ marginTop: '1rem', width: '100%' }}
                onClick={() => setIsDetailModalOpen(false)}
              >
                닫기
              </button>
            </div>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
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
