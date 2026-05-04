'use client';

import { useEffect, useState, Suspense, Fragment } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

function DashboardContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const [round, setRound] = useState(null);
  const [expandedHole, setExpandedHole] = useState(null);

  useEffect(() => {
    if (id) {
      const saved = localStorage.getItem('golf-rounds');
      if (saved) {
        const parsed = JSON.parse(saved);
        const found = parsed.find(r => r.id === id);
        if (found) setRound(found);
      }
    }
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
      
      // Score 계산 (기존 로직: 샷수 + 벌타)
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
      const penaltyCount = shots.filter(s => s.penalty !== '-').length;
      const penaltyType = shots.find(s => s.penalty !== '-') ? shots.find(s => s.penalty !== '-').penalty : '-';
      
      // 메모 기반 샷 퀄리티 (탑볼, 뒷땅, 더덕)
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

    const outHoles = holes.slice(0, 9);
    const inHoles = holes.slice(9, 18);

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
      out: getStats(outHoles), 
      in: getStats(inHoles), 
      total: getStats(holes) 
    };
  };

  const data = processData();

  const toggleHole = (holeNum) => {
    setExpandedHole(expandedHole === holeNum ? null : holeNum);
  };

  const getRowClass = (diff) => {
    if (diff <= -1) return 'bg-birdie';
    if (diff === 0) return 'bg-par';
    if (diff === 1) return 'bg-bogey';
    return 'bg-double';
  };

  return (
    <div className="dashboard-container" style={{ animation: 'fadeIn 0.5s ease-out' }}>
      {/* --- 상단 헤더 --- */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <Link href="/" style={{ textDecoration: 'none', color: 'var(--accent-neon)', fontWeight: 'bold' }}>← BACK TO HOME</Link>
        <div style={{ textAlign: 'right' }}>
          <h1 style={{ margin: 0, fontSize: '2rem' }}>{round.course}</h1>
          <div style={{ color: 'var(--text-secondary)' }}>{round.date} | Total Score: <span style={{ color: 'var(--accent-neon)', fontWeight: 'bold' }}>{data.total.score}</span> ({data.total.score - data.total.par > 0 ? '+' : ''}{data.total.score - data.total.par})</div>
        </div>
      </div>

      {/* --- 요약 섹션 (Cards) --- */}
      <div className="summary-grid">
        <div className="summary-card">
          <h4>Score Distribution</h4>
          <div className="summary-value" style={{ fontSize: '1.2rem' }}>
            B:{data.total.birdies} / P:{data.total.pars} / B:{data.total.bogeys}
          </div>
          <div className="summary-subtext">D:{data.total.dbogeys} / T:{data.total.tbogeys} / DP:{data.total.doublePars}</div>
        </div>
        <div className="summary-card">
          <h4>Putting & Touch</h4>
          <div className="summary-value">{data.total.threePutts} <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>3-Putts</span></div>
          <div className="summary-subtext">땡그랑(1-Putt/Chip-in): <span style={{ color: 'var(--accent-neon)' }}>{data.total.onePutts}</span></div>
        </div>
        <div className="summary-card">
          <h4>Shot Quality</h4>
          <div className="summary-value">{data.total.tops} / {data.total.duffs}</div>
          <div className="summary-subtext">Top(탑볼) / Duff(뒷땅,더덕)</div>
        </div>
        <div className="summary-card">
          <h4>Max Drive</h4>
          <div className="summary-value">{data.total.maxDrive} <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>m</span></div>
          <div className="summary-subtext">Round Best Driver Distance</div>
        </div>
      </div>

      {/* --- 메인 테이블 --- */}
      <div className="table-container">
        <table className="dashboard-main-table">
          <thead>
            <tr>
              <th>Hole</th>
              <th>Par</th>
              <th>Score</th>
              <th>Net</th>
              <th>HDCP</th>
              <th>Putt</th>
              <th>T-Club</th>
              <th>F/W</th>
              <th>GIR</th>
              <th>Penalty</th>
              <th>Sand</th>
              <th style={{ width: '150px' }}>Memo</th>
            </tr>
          </thead>
          <tbody>
            {data.holes.map((h) => (
              <Fragment key={h.hole}>
                <tr onClick={() => toggleHole(h.hole)} className={getRowClass(h.diff)}>
                  <td className="mono" style={{ fontWeight: 'bold' }}>{h.hole}</td>
                  <td className="mono">{h.par}</td>
                  <td className="mono" style={{ fontWeight: 'bold' }}>{h.score}</td>
                  <td className="mono">{h.score}</td> {/* Net Score - 우선 Score와 동일하게 표시 */}
                  <td className="mono" style={{ opacity: 0.5 }}>-</td>
                  <td className="mono">{h.putts}</td>
                  <td className="mono" style={{ color: 'var(--accent-neon)' }}>{h.teeClub}</td>
                  <td className="mono">{h.fw ? 'O' : 'X'}</td>
                  <td className="mono">{h.gir ? 'O' : 'X'}</td>
                  <td className={`mono ${h.penaltyType !== '-' ? 'penalty-text' : ''}`}>{h.penaltyType}</td>
                  <td className="mono">{h.sandShots > 0 ? h.sandShots : '-'}</td>
                  <td style={{ fontSize: '0.75rem', textAlign: 'left', opacity: 0.7 }}>{h.memo || '-'}</td>
                </tr>
                {expandedHole === h.hole && (
                  <tr className="detail-row">
                    <td colSpan="12">
                      <div className="detail-content" style={{ animation: 'slideDown 0.3s ease-out' }}>
                        <div style={{ marginBottom: '1rem', fontWeight: 'bold', color: 'var(--accent-neon)' }}>Hole {h.hole} Detailed Shots</div>
                        <div className="shot-timeline">
                          {h.shots.map((s, idx) => (
                            <div key={idx} className="shot-card">
                              <div className="shot-card-header">SHOT {idx + 1}</div>
                              <div className="shot-card-body">
                                <div><strong>{s.club}</strong> ({s.shotType})</div>
                                <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>Landing: {s.landing}</div>
                                <div style={{ fontSize: '0.8rem' }}>{s.tDis || '-'}/{s.fDis || '-'} m</div>
                                {s.penalty !== '-' && <div style={{ color: '#ef4444', fontSize: '0.75rem' }}>Penalty: {s.penalty}</div>}
                                {s.memo && <div style={{ fontSize: '0.7rem', fontStyle: 'italic', marginTop: '0.2rem' }}>{`"${s.memo}"`}</div>}
                              </div>
                            </div>
                          ))}
                          {h.shots.length === 0 && <div style={{ opacity: 0.5 }}>기록된 샷이 없습니다.</div>}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
          {/* 하단 합계 행 */}
          <tfoot style={{ background: 'rgba(255,255,255,0.05)', fontWeight: 'bold' }}>
            <tr>
              <td>TOTAL</td>
              <td className="mono">{data.total.par}</td>
              <td className="mono" style={{ color: 'var(--accent-neon)' }}>{data.total.score}</td>
              <td className="mono">{data.total.score}</td>
              <td className="mono">-</td>
              <td className="mono">{data.total.putts}</td>
              <td colSpan="6"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideDown { from { opacity: 0; max-height: 0; } to { opacity: 1; max-height: 1000px; } }
        .dashboard-main-table tfoot td { padding: 1rem 0.5rem; border-top: 2px solid var(--accent-neon); }
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
