'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function EventHome({ event, slug }) {
  const [activeTab, setActiveTab] = useState('event');
  const [showNotice, setShowNotice] = useState(true);

  const hasLunch = !!event.lunch;
  const notice = event.notice;
  const mapLinks = event.map_links || {};
  const schedule = event.schedule || [];
  const groups = event.groups || [];

  // Allow body scroll for this page
  useEffect(() => {
    document.body.classList.add('allow-scroll');
    return () => document.body.classList.remove('allow-scroll');
  }, []);

  const copyAddress = (addr) => {
    navigator.clipboard.writeText(addr).then(() => alert('주소가 복사되었습니다.'));
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
    } catch {
      return dateStr;
    }
  };

  return (
    <>
      {/* ── 공지 팝업 ── */}
      {notice?.enabled && showNotice && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'linear-gradient(135deg, #0f172a, #1e293b)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '20px',
            padding: '2.5rem 2rem 1.5rem',
            width: 'min(90vw, 380px)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
          }}>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>{notice.emoji || '🔔'}</div>
              <p style={{ fontSize: '1.1rem', fontWeight: '700', lineHeight: 1.7, background: 'linear-gradient(135deg, #e2e8f0, #cbd5e1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>
                {notice.title}
              </p>
              {notice.body && (
                <p style={{ fontSize: '0.95rem', fontWeight: '600', lineHeight: 1.7, color: '#10b981', marginTop: '0.75rem', marginBottom: 0, whiteSpace: 'pre-line' }}>
                  {notice.body}
                </p>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNotice(false)} style={{ padding: '0.55rem 1.4rem', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '10px', color: '#94a3b8', fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer' }}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 메인 컨테이너 ── */}
      <div className="container" style={{ height: '100vh', overflowY: 'auto', animation: 'fadeIn 0.5s ease-out', paddingBottom: '100px', maxWidth: '600px', margin: '0 auto' }}>
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
          .ev-tab-container { display: flex; margin-bottom: 1rem; background: rgba(255,255,255,0.05); border-radius: 16px; padding: 0.4rem; box-shadow: inset 0 2px 4px rgba(0,0,0,0.2); }
          .ev-tab-btn { flex: 1; padding: 0.8rem 1rem; text-align: center; border-radius: 12px; color: var(--text-secondary); cursor: pointer; transition: all 0.3s; font-weight: 700; font-size: 1rem; }
          .ev-tab-btn.active { background: linear-gradient(135deg, var(--accent-neon), #059669); color: white; box-shadow: 0 4px 12px rgba(16,185,129,0.4); }
          .ev-info-card { background: rgba(255,255,255,0.03); border: 1px solid var(--glass-border); border-radius: 12px; padding: 1.2rem 1rem; margin-bottom: 0.75rem; }
          .ev-schedule-row { display: flex; justify-content: flex-start; gap: 1rem; margin-bottom: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.5rem; text-align: left; }
          .ev-schedule-label { color: var(--text-secondary); width: 45px; flex-shrink: 0; font-size: 0.9rem; }
          .ev-group-table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; }
          .ev-group-table th, .ev-group-table td { padding: 0.5rem; border: 1px solid rgba(255,255,255,0.1); text-align: center; font-size: 0.8rem; letter-spacing: -0.05em; white-space: nowrap; }
          .ev-group-table th { background: rgba(255,255,255,0.05); color: var(--accent-neon); }
          .ev-map-btn { display: block; padding: 0.75rem; border-radius: 8px; text-align: center; font-weight: 600; text-decoration: none; flex: 1; font-size: 0.85rem; }
          .ev-map-naver { background: #03c75a; color: white; }
          .ev-map-kakao { background: #fee500; color: #191919; }
          .ev-map-tmap { background: #000; border: 1px solid #333; color: white; }
        `}} />

        {/* ── 타이틀 ── */}
        <div style={{ textAlign: 'center', padding: '0.5rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1rem' }}>
          <h1 style={{ width: '100%', fontSize: '2rem', marginBottom: '0.5rem', lineHeight: 1.3, whiteSpace: 'pre-line' }}>
            <span style={{ background: 'linear-gradient(45deg, #00f2fe 0%, #4facfe 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{event.title}</span>
          </h1>
          {event.subtitle && (
            <p style={{ color: '#facc15', fontSize: '1.1rem', fontWeight: 'bold', textShadow: '0 2px 4px rgba(0,0,0,0.3)', marginTop: '0.5rem', marginBottom: 0 }}>
              {event.subtitle}
            </p>
          )}
        </div>

        {/* ── 탭 (중식 있을 때만) ── */}
        {hasLunch && (
          <div className="ev-tab-container">
            <div className={`ev-tab-btn ${activeTab === 'event' ? 'active' : ''}`} onClick={() => setActiveTab('event')}>📍 행사 개요</div>
            <div className={`ev-tab-btn ${activeTab === 'lunch' ? 'active' : ''}`} onClick={() => setActiveTab('lunch')}>🍽️ 중식 안내</div>
          </div>
        )}

        {/* ── 행사 개요 탭 ── */}
        {activeTab === 'event' && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>

            {/* 일시 및 장소 */}
            <div className="ev-info-card">
              <h3 style={{ color: 'var(--accent-neon)', marginTop: 0 }}>📍 일시 및 장소</h3>
              {event.event_date && (
                <div className="ev-schedule-row">
                  <span className="ev-schedule-label">일시</span>
                  <span>{formatDate(event.event_date)}</span>
                </div>
              )}
              {event.course_name && (
                <div className="ev-schedule-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <span className="ev-schedule-label">장소</span>
                    <div>
                      <div>
                        {event.course_name}
                        {event.course_distance_note && <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}> ({event.course_distance_note})</span>}
                      </div>
                      {event.course_address && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{event.course_address}</div>
                          <button onClick={() => copyAddress(event.course_address)} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', color: 'white', fontSize: '0.65rem', padding: '0.2rem 0.4rem', cursor: 'pointer' }}>복사</button>
                        </div>
                      )}
                      {event.course_phone && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem' }}>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{event.course_phone}</div>
                          <a href={`tel:${event.course_phone}`} style={{ padding: '0.2rem 0.5rem', background: 'rgba(16,185,129,0.15)', border: '1px solid var(--accent-neon)', borderRadius: '6px', color: 'var(--accent-neon)', fontSize: '0.75rem', textDecoration: 'none', fontWeight: 'bold' }}>📞 전화하기</a>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 지도 링크 */}
                  {(mapLinks.naver || mapLinks.kakao || mapLinks.tmap) && (
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', width: '100%' }}>
                      {mapLinks.naver && <a href={mapLinks.naver} target="_blank" rel="noreferrer" className="ev-map-btn ev-map-naver">네이버지도</a>}
                      {mapLinks.kakao && <a href={mapLinks.kakao} target="_blank" rel="noreferrer" className="ev-map-btn ev-map-kakao">카카오지도</a>}
                      {mapLinks.tmap && <a href={mapLinks.tmap} target="_blank" rel="noreferrer" className="ev-map-btn ev-map-tmap">티맵</a>}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 상세 일정 */}
            {schedule.length > 0 && (
              <div className="ev-info-card">
                <h3 style={{ color: 'var(--accent-neon)', marginTop: 0 }}>⏰ 상세 일정</h3>
                {schedule.map((row, i) => (
                  <div key={i} className="ev-schedule-row" style={i === schedule.length - 1 ? { borderBottom: 'none' } : {}}>
                    <span className="ev-schedule-label">{row.time}</span>
                    <span style={{ whiteSpace: 'pre-line' }}>{row.text}</span>
                  </div>
                ))}
              </div>
            )}

            {/* 조편성 */}
            {groups.length > 0 && (
              <div className="ev-info-card">
                <h3 style={{ color: 'var(--accent-neon)', marginTop: 0 }}>👥 조편성</h3>
                <table className="ev-group-table">
                  <thead>
                    <tr><th>코스</th><th>시간</th><th>참석자</th></tr>
                  </thead>
                  <tbody>
                    {groups.map((g, i) => (
                      <tr key={i}>
                        <td>{g.course}</td>
                        <td>{g.time}</td>
                        <td>{g.players}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 시상/정산 */}
            {(event.award_text || event.settlement_text) && (
              <div className="ev-info-card">
                <h3 style={{ color: 'var(--accent-neon)', marginTop: 0 }}>🏆 시상 및 정산</h3>
                {event.award_text && (
                  <div style={{ marginBottom: '1rem' }}>
                    <strong style={{ display: 'block', marginBottom: '0.3rem' }}>시상</strong>
                    <span style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-line' }}>{event.award_text}</span>
                  </div>
                )}
                {event.settlement_text && (
                  <div>
                    <strong style={{ display: 'block', marginBottom: '0.3rem' }}>현장 결제 안내</strong>
                    <span style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-line' }}>{event.settlement_text}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── 중식 탭 ── */}
        {activeTab === 'lunch' && hasLunch && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <div className="ev-info-card">
              <h3 style={{ color: 'var(--accent-neon)', marginTop: 0, textAlign: 'center', fontSize: '1.4rem' }}>🍽️ {event.lunch.name}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                {event.lunch.address && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>주소</div>
                      <div style={{ fontSize: '0.95rem' }}>{event.lunch.address}</div>
                    </div>
                    <button onClick={() => copyAddress(event.lunch.address)} style={{ flexShrink: 0, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', color: 'white', fontSize: '0.7rem', padding: '0.2rem 0.5rem', cursor: 'pointer' }}>복사</button>
                  </div>
                )}
                {event.lunch.phone && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>전화번호</div>
                      <div style={{ fontSize: '0.95rem' }}>{event.lunch.phone}</div>
                    </div>
                    <a href={`tel:${event.lunch.phone}`} style={{ padding: '0.2rem 0.5rem', background: 'rgba(16,185,129,0.15)', border: '1px solid var(--accent-neon)', borderRadius: '4px', color: 'var(--accent-neon)', fontSize: '0.7rem', textDecoration: 'none', fontWeight: 'bold' }}>📞 전화</a>
                  </div>
                )}
                {event.lunch.menu && (
                  <div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>메뉴</div>
                    <div style={{ fontWeight: 'bold', color: 'var(--accent-neon)' }}>{event.lunch.menu}</div>
                  </div>
                )}
              </div>
              {(event.lunch.mapNaver || event.lunch.mapKakao) && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {event.lunch.mapNaver && <a href={event.lunch.mapNaver} target="_blank" rel="noreferrer" className="ev-map-btn ev-map-naver">네이버지도</a>}
                  {event.lunch.mapKakao && <a href={event.lunch.mapKakao} target="_blank" rel="noreferrer" className="ev-map-btn ev-map-kakao">카카오지도</a>}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── 하단 고정 버튼 ── */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '1rem', background: 'rgba(15,23,42,0.9)', backdropFilter: 'blur(10px)', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'center', zIndex: 100 }}>
        <Link href={`/go/${encodeURIComponent(slug)}/record`} style={{ textDecoration: 'none', width: '100%', maxWidth: '600px' }}>
          <button style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', boxShadow: '0 4px 14px 0 rgba(59,130,246,0.4)', width: '100%', padding: '1rem', fontSize: '1.05rem', fontWeight: 'bold', border: 'none', borderRadius: '12px', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            🗺️ 코스 야디지 바로가기
          </button>
        </Link>
      </div>
    </>
  );
}
