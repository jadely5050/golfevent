'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get('id');
  const [round, setRound] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (id) {
      const saved = localStorage.getItem('golf-rounds');
      if (saved) {
        const parsed = JSON.parse(saved);
        const found = parsed.find(r => r.id === id);
        if (found) {
          setRound(found);
        }
      }
    }
  }, [id]);

  if (!round) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: '5rem 1rem' }}>
        <p>라운드 데이터를 찾을 수 없습니다.</p>
        <Link href="/">
          <button className="btn btn-secondary">홈으로 돌아가기</button>
        </Link>
      </div>
    );
  }

  // 데이터 가공 로직
  const processHoleData = (hole) => {
    const shots = hole.shots || [];
    const par = hole.par || 4;
    
    // Score 계산 (기존 로직 유지)
    const score = shots.length + shots.reduce((acc, s, idx) => {
      let penalty = 0;
      if (s.penalty === 'O') {
        penalty = (par >= 4 && idx === 0) ? 2 : 1;
      } else if (s.penalty === 'H') {
        penalty = 1;
      }
      return acc + penalty;
    }, 0);

    const putts = shots.filter(s => s.club === 'Pt').length;
    const isGIR = (shots.length - putts) <= (par - 2);
    const fairwayHit = shots.length > 0 && shots[0].club !== 'Pt' && shots[0].landing === 'F';
    const teeClub = (shots.length > 0 && shots[0].club !== 'Pt') ? shots[0].club : '-';

    return { ...hole, score, putts, isGIR, fairwayHit, teeClub };
  };

  const processedHoles = round.holes.map(processHoleData);
  const outHoles = processedHoles.slice(0, 9);
  const inHoles = processedHoles.slice(9, 18);

  const calculateTotal = (holes) => ({
    par: holes.reduce((a, b) => a + b.par, 0),
    score: holes.reduce((a, b) => a + b.score, 0),
    putts: holes.reduce((a, b) => a + b.putts, 0),
    gir: holes.filter(h => h.isGIR).length,
    fw: holes.filter(h => h.fairwayHit).length
  });

  const outTotal = calculateTotal(outHoles);
  const inTotal = calculateTotal(inHoles);
  const grandTotal = calculateTotal(processedHoles);

  // 클럽별 통계
  const allShots = processedHoles.flatMap(h => h.shots || []);
  const clubStats = allShots.reduce((acc, s) => {
    if (!acc[s.club]) acc[s.club] = { used: 0, hzd: 0, ob: 0, dists: [] };
    acc[s.club].used += 1;
    if (s.penalty === 'H') acc[s.club].hzd += 1;
    if (s.penalty === 'O') acc[s.club].ob += 1;
    if (s.fDis) acc[s.club].dists.push(parseInt(s.fDis));
    return acc;
  }, {});

  // 스코어 분포
  const scoreDist = processedHoles.reduce((acc, h) => {
    const diff = h.score - h.par;
    if (h.putts >= 3) acc['3putt'] = (acc['3putt'] || 0) + 1;
    if (diff <= -2) acc['eagle'] = (acc['eagle'] || 0) + 1;
    else if (diff === -1) acc['birdie'] = (acc['birdie'] || 0) + 1;
    else if (diff === 0) acc['par'] = (acc['par'] || 0) + 1;
    else if (diff === 1) acc['bogey'] = (acc['bogey'] || 0) + 1;
    else if (diff === 2) acc['dbogey'] = (acc['dbogey'] || 0) + 1;
    else if (diff === 3) acc['tbogey'] = (acc['tbogey'] || 0) + 1;
    else acc['others'] = (acc['others'] || 0) + 1;
    return acc;
  }, {});

  const renderPC = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '2px solid var(--accent-neon)', paddingBottom: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2.5rem' }}>{round.course}</h1>
          <div style={{ color: 'var(--text-secondary)', fontSize: '1.2rem' }}>{round.date}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '3rem', fontWeight: '900', lineHeight: 1 }}>
            {grandTotal.score} <span style={{ fontSize: '1.5rem', fontWeight: '400', color: 'var(--text-secondary)' }}>({grandTotal.score - grandTotal.par > 0 ? '+' : ''}{grandTotal.score - grandTotal.par})</span>
          </div>
          <div style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>Total Putts: {grandTotal.putts}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '2rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Scorecard Table */}
          <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="dashboard-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.1)' }}>
                  <th style={{ padding: '0.5rem' }}>HOLE</th>
                  {[...Array(9)].map((_, i) => <th key={i}>{i + 1}</th>)}
                  <th style={{ borderLeft: '1px solid var(--glass-border)' }}>OUT</th>
                  {[...Array(9)].map((_, i) => <th key={i + 9}>{i + 10}</th>)}
                  <th style={{ borderLeft: '1px solid var(--glass-border)' }}>IN</th>
                  <th style={{ borderLeft: '2px solid var(--accent-neon)' }}>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>PAR</td>
                  {outHoles.map((h, i) => <td key={i}>{h.par}</td>)}
                  <td style={{ borderLeft: '1px solid var(--glass-border)', fontWeight: 'bold' }}>{outTotal.par}</td>
                  {inHoles.map((h, i) => <td key={i}>{h.par}</td>)}
                  <td style={{ borderLeft: '1px solid var(--glass-border)', fontWeight: 'bold' }}>{inTotal.par}</td>
                  <td style={{ borderLeft: '2px solid var(--accent-neon)', fontWeight: 'bold' }}>{grandTotal.par}</td>
                </tr>
                <tr>
                  <td>SCORE</td>
                  {outHoles.map((h, i) => <td key={i} style={{ color: h.score < h.par ? 'var(--accent-neon)' : h.score > h.par ? '#ff4d4d' : 'white' }}>{h.score}</td>)}
                  <td style={{ borderLeft: '1px solid var(--glass-border)', fontWeight: 'bold' }}>{outTotal.score}</td>
                  {inHoles.map((h, i) => <td key={i} style={{ color: h.score < h.par ? 'var(--accent-neon)' : h.score > h.par ? '#ff4d4d' : 'white' }}>{h.score}</td>)}
                  <td style={{ borderLeft: '1px solid var(--glass-border)', fontWeight: 'bold' }}>{inTotal.score}</td>
                  <td style={{ borderLeft: '2px solid var(--accent-neon)', fontWeight: 'bold' }}>{grandTotal.score}</td>
                </tr>
                <tr>
                  <td>PUTT</td>
                  {outHoles.map((h, i) => <td key={i}>{h.putts}</td>)}
                  <td style={{ borderLeft: '1px solid var(--glass-border)' }}>{outTotal.putts}</td>
                  {inHoles.map((h, i) => <td key={i}>{h.putts}</td>)}
                  <td style={{ borderLeft: '1px solid var(--glass-border)' }}>{inTotal.putts}</td>
                  <td style={{ borderLeft: '2px solid var(--accent-neon)' }}>{grandTotal.putts}</td>
                </tr>
                <tr>
                  <td>GIR</td>
                  {outHoles.map((h, i) => <td key={i} style={{ color: 'var(--accent-neon)' }}>{h.isGIR ? '●' : ''}</td>)}
                  <td style={{ borderLeft: '1px solid var(--glass-border)' }}>{outTotal.gir}</td>
                  {inHoles.map((h, i) => <td key={i} style={{ color: 'var(--accent-neon)' }}>{h.isGIR ? '●' : ''}</td>)}
                  <td style={{ borderLeft: '1px solid var(--glass-border)' }}>{inTotal.gir}</td>
                  <td style={{ borderLeft: '2px solid var(--accent-neon)' }}>{grandTotal.gir}</td>
                </tr>
                <tr>
                  <td>F/W</td>
                  {outHoles.map((h, i) => <td key={i} style={{ color: '#4dabf7' }}>{h.fairwayHit ? '●' : ''}</td>)}
                  <td style={{ borderLeft: '1px solid var(--glass-border)' }}>{outTotal.fw}</td>
                  {inHoles.map((h, i) => <td key={i} style={{ color: '#4dabf7' }}>{h.fairwayHit ? '●' : ''}</td>)}
                  <td style={{ borderLeft: '1px solid var(--glass-border)' }}>{inTotal.fw}</td>
                  <td style={{ borderLeft: '2px solid var(--accent-neon)' }}>{grandTotal.fw}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Shot Details Grid */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem', borderLeft: '4px solid var(--accent-neon)', paddingLeft: '0.5rem' }}>상세 샷 기록</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '1rem' }}>
              {processedHoles.map(h => (
                <div key={h.hole} style={{ background: 'rgba(255,255,255,0.03)', padding: '0.5rem', borderRadius: '8px' }}>
                  <div style={{ fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '0.3rem', paddingBottom: '0.2rem' }}>{h.hole}H (Par {h.par})</div>
                  {h.shots && h.shots.map((s, idx) => (
                    <div key={idx} style={{ fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', opacity: 0.8 }}>
                      <span>{s.club} {s.shotType}</span>
                      <span>{s.tDis || s.fDis || '-'}m</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="glass-panel" style={{ padding: '1rem' }}>
            <h4 style={{ marginTop: 0, color: 'var(--accent-neon)' }}>클럽별 사용 통계</h4>
            <div style={{ fontSize: '0.85rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.3rem' }}>
                <span>Club</span>
                <span>Used</span>
                <span>Err(H/O)</span>
              </div>
              {Object.entries(clubStats).sort((a, b) => b[1].used - a[1].used).map(([club, stat]) => (
                <div key={club} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '0.2rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span>{club}</span>
                  <span>{stat.used}</span>
                  <span style={{ color: (stat.hzd + stat.ob) > 0 ? '#ff4d4d' : 'inherit' }}>{stat.hzd}/{stat.ob}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '1rem' }}>
            <h4 style={{ marginTop: 0, color: 'var(--accent-neon)' }}>스코어 분포</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {[
                { label: 'Birdie-', value: (scoreDist.eagle || 0) + (scoreDist.birdie || 0), color: 'var(--accent-neon)' },
                { label: 'Par', value: scoreDist.par || 0, color: 'white' },
                { label: 'Bogey', value: scoreDist.bogey || 0, color: '#fcc419' },
                { label: 'Double+', value: (scoreDist.dbogey || 0) + (scoreDist.tbogey || 0) + (scoreDist.others || 0), color: '#ff4d4d' },
                { label: '3-Putts', value: scoreDist['3putt'] || 0, color: '#fab005' }
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.9rem' }}>{item.label}</span>
                  <span style={{ fontWeight: 'bold', color: item.color }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .dashboard-table th, .dashboard-table td {
          padding: 0.4rem;
          border-bottom: 1px solid var(--glass-border);
          font-size: 0.9rem;
        }
        .dashboard-table th { font-weight: 600; color: var(--text-secondary); }
      `}</style>
    </div>
  );

  const renderMobile = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>{round.course}</h1>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{round.date}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div className="glass-panel" style={{ textAlign: 'center', padding: '1rem' }}>
          <div style={{ fontSize: '2rem', fontWeight: '900', color: 'var(--accent-neon)' }}>{grandTotal.score}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>SCORE</div>
        </div>
        <div className="glass-panel" style={{ textAlign: 'center', padding: '1rem' }}>
          <div style={{ fontSize: '2rem', fontWeight: '900' }}>{Math.round((grandTotal.gir / 18) * 100)}%</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>GIR</div>
        </div>
        <div className="glass-panel" style={{ textAlign: 'center', padding: '1rem' }}>
          <div style={{ fontSize: '2rem', fontWeight: '900' }}>{(grandTotal.putts / 18).toFixed(1)}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>AVG PUTTS</div>
        </div>
        <div className="glass-panel" style={{ textAlign: 'center', padding: '1rem' }}>
          <div style={{ fontSize: '2rem', fontWeight: '900' }}>{grandTotal.fw}/14</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>FAIRWAY</div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '1rem' }}>
        <h4 style={{ marginTop: 0, marginBottom: '0.75rem' }}>OUT COURSE</h4>
        <table style={{ width: '100%', textAlign: 'center', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ color: 'var(--text-secondary)' }}>
              <th>H</th>
              <th>P</th>
              <th>S</th>
              <th>P</th>
              <th>G</th>
            </tr>
          </thead>
          <tbody>
            {outHoles.map(h => (
              <tr key={h.hole}>
                <td style={{ padding: '0.3rem' }}>{h.hole}</td>
                <td>{h.par}</td>
                <td style={{ fontWeight: 'bold', color: h.score < h.par ? 'var(--accent-neon)' : 'inherit' }}>{h.score}</td>
                <td>{h.putts}</td>
                <td style={{ color: 'var(--accent-neon)' }}>{h.isGIR ? '●' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="glass-panel" style={{ padding: '1rem' }}>
        <h4 style={{ marginTop: 0, marginBottom: '0.75rem' }}>IN COURSE</h4>
        <table style={{ width: '100%', textAlign: 'center', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ color: 'var(--text-secondary)' }}>
              <th>H</th>
              <th>P</th>
              <th>S</th>
              <th>P</th>
              <th>G</th>
            </tr>
          </thead>
          <tbody>
            {inHoles.map(h => (
              <tr key={h.hole}>
                <td style={{ padding: '0.3rem' }}>{h.hole}</td>
                <td>{h.par}</td>
                <td style={{ fontWeight: 'bold', color: h.score < h.par ? 'var(--accent-neon)' : 'inherit' }}>{h.score}</td>
                <td>{h.putts}</td>
                <td style={{ color: 'var(--accent-neon)' }}>{h.isGIR ? '●' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {round.memo && (
        <div className="glass-panel" style={{ padding: '1rem' }}>
          <h4 style={{ marginTop: 0, marginBottom: '0.5rem' }}>MEMO</h4>
          <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.8, whiteSpace: 'pre-wrap' }}>{round.memo}</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="container" style={{ animation: 'fadeIn 0.5s ease-out' }}>
      <div style={{ marginBottom: '1rem' }}>
        <Link href="/" style={{ textDecoration: 'none', color: 'var(--accent-neon)' }}>← Back to List</Link>
      </div>
      {isMobile ? renderMobile() : renderPC()}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}} />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="container" style={{ textAlign: 'center', padding: '5rem' }}>Loading Dashboard...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
