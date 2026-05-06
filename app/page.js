'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function Dashboard() {
  const [recentRounds, setRecentRounds] = useState([]);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [serverRounds, setServerRounds] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadLocalRounds = () => {
    const saved = localStorage.getItem('golf-rounds');
    if (saved) {
      setRecentRounds(JSON.parse(saved));
    } else {
      setRecentRounds([
        { id: '1', date: '2026.04.20', course: '오거스타 내셔널', score: 72, par: 72, putts: 28 },
        { id: '2', date: '2026.04.15', course: '페블비치', score: 75, par: 72, putts: 31 }
      ]);
    }
  };

  useEffect(() => {
    loadLocalRounds();
  }, []);

  const fetchServerRounds = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/rounds');
      const data = await res.json();
      setServerRounds(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      alert('데이터를 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const importRound = (round) => {
    const saved = localStorage.getItem('golf-rounds');
    let parsed = saved ? JSON.parse(saved) : [];
    if (!Array.isArray(parsed)) parsed = [];
    const filtered = parsed.filter(r => r.id !== round.id);
    const updated = [round, ...filtered].sort((a, b) => new Date(b.date) - new Date(a.date));
    localStorage.setItem('golf-rounds', JSON.stringify(updated));
    setRecentRounds(updated);
    alert(`${round.course} 기록을 가져왔습니다.`);
  };

  const uploadRound = async (e, round) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm('사진을 포함하여 서버로 업로드할까요?')) {
      setIsLoading(true);
      try {
        // 1. IndexedDB에서 사진 가져오기
        const images = await new Promise((resolve) => {
          const request = indexedDB.open('golf-images', 1);
          request.onsuccess = (e) => {
            const db = e.target.result;
            const transaction = db.transaction(['images'], 'readonly');
            const store = transaction.objectStore('images');
            const getAllRequest = store.getAll();
            getAllRequest.onsuccess = () => {
              const allImages = getAllRequest.result;
              // 해당 라운드 ID와 일치하는 사진만 필터링
              resolve(allImages.filter(img => img.roundId === round.id));
            };
          };
          request.onerror = () => resolve([]);
        });

        // 2. 사진들을 R2로 업로드하고 URL 받기
        const uploadedImages = [];
        for (const img of images) {
          const formData = new FormData();
          formData.append('file', img.file);
          formData.append('fileName', `round_${round.id}_hole_${img.hole}.jpg`);

          const uploadRes = await fetch('/api/upload', {
            method: 'POST',
            body: formData
          });

          if (uploadRes.ok) {
            const { url } = await uploadRes.json();
            uploadedImages.push({
              id: img.id,
              hole: img.hole,
              latitude: img.latitude,
              longitude: img.longitude,
              addedAt: img.addedAt,
              url: url
            });
          }
        }

        // 3. 사진 및 드로잉 정보가 포함된 라운드 데이터 구성
        const drawings = (round.holes || []).reduce((acc, hole) => {
          if (hole.drawings) acc[hole.hole] = hole.drawings;
          return acc;
        }, {});

        const finalRoundData = {
          ...round,
          images: uploadedImages,
          drawings: drawings
        };

        // 4. Neon DB로 최종 업로드
        const res = await fetch('/api/rounds', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(finalRoundData)
        });


        if (res.ok) {
          alert(`서버로 업로드되었습니다. (사진 ${uploadedImages.length}장 포함)`);
        } else {
          alert('업로드에 실패했습니다.');
        }
      } catch (err) {
        console.error(err);
        alert('업로드 중 오류가 발생했습니다.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const avgScore = recentRounds.length ? Math.round(recentRounds.reduce((a, b) => a + b.score, 0) / recentRounds.length) : '-';
  const avgPutts = recentRounds.length ? Math.round(recentRounds.reduce((a, b) => a + b.putts, 0) / recentRounds.length) : '-';

  return (
    <div className="container" style={{ animation: 'fadeIn 0.5s ease-out', position: 'relative' }}>
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}} />

      <div style={{ position: 'absolute', top: '-10px', right: '10px' }}>
        <button onClick={() => { setShowSyncModal(true); fetchServerRounds(); }} style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>⚙️</button>
      </div>

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
            <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: 0, cursor: 'pointer', paddingRight: '0.5rem' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>{round.date}</div>
                <div style={{ fontWeight: '600', fontSize: '1.1rem' }}>{round.course}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: '800', color: round.score <= round.par ? 'var(--accent-neon)' : 'white' }}>
                    {round.score}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{round.putts} 퍼팅</div>
                </div>
                <button
                  onClick={(e) => uploadRound(e, round)}
                  style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px' }}
                  title="서버로 업로드"
                >
                  ☁️
                </button>
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

      {showSyncModal && (
        <div className="modal-overlay" onClick={() => setShowSyncModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0 }}>클라우드 동기화</h2>
              <button onClick={() => setShowSyncModal(false)} style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '1.5rem' }}>×</button>
            </div>

            <button className="btn btn-primary" onClick={fetchServerRounds} disabled={isLoading} style={{ width: '100%', marginBottom: '1.5rem' }}>
              {isLoading ? '불러오는 중...' : '데이터 새로고침'}
            </button>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {serverRounds.map((round) => (
                <div key={round.id} className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: 0, padding: '0.75rem' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{round.date}</div>
                    <div style={{ fontWeight: '600' }}>{round.course}</div>
                    <div style={{ fontSize: '0.8rem' }}>Score: {round.score}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Link href={`/dashboard?id=${round.id}&cloud=true`} onClick={(e) => e.stopPropagation()} style={{ textDecoration: 'none' }}>
                      <button 
                        className="btn btn-secondary"
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="클라우드 대시보드 보기"
                      >
                        Dashboard
                      </button>
                    </Link>
                    <button className="btn btn-secondary" onClick={() => importRound(round)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                      가져오기
                    </button>
                  </div>
                </div>
              ))}
              {serverRounds.length === 0 && !isLoading && <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>서버에 저장된 기록이 없습니다.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
