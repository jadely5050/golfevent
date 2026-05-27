'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import YardageDrawingBoard from './YardageDrawingBoard';

export default function RecordViewer({ slug, courseName, parInfo, yardageImages, greenImages, groups }) {
  const router = useRouter();
  const storagePrefix = `event_${slug}_`;

  const initialHoles = Array.from({ length: 18 }, (_, i) => ({
    hole: i + 1,
    par: (parInfo && parInfo[i]) || 4,
  }));

  const [currentHoleIdx, setCurrentHoleIdx] = useState(0);
  const [showHoleSelectModal, setShowHoleSelectModal] = useState(false);
  const [showGreenModal, setShowGreenModal] = useState(false);
  const [modalStep, setModalStep] = useState(null); // null | 'tee' | 'group'
  const [startCourse, setStartCourse] = useState('valley');
  const [selectedGroupName, setSelectedGroupName] = useState('');
  const [tutorialStep, setTutorialStep] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);

  const currentHole = initialHoles[currentHoleIdx];

  // Map yardage/green images to hole lookup
  const yardageMap = Object.fromEntries((yardageImages || []).map(img => [img.hole, img.url]));
  const greenMap = Object.fromEntries((greenImages || []).map(img => [img.hole, img.url]));

  const yardageSrc = yardageMap[currentHole.hole] || null;
  const greenImgSrc = greenMap[currentHole.hole] || null;

  const getDisplayHoleNumber = (actualHole) => {
    if (startCourse === 'valley') return actualHole;
    if (actualHole >= 10) return actualHole - 9;
    return actualHole + 9;
  };

  const courseSectionName = (hole) => hole <= 9 ? '밸리' : '레이크';

  // App height for iOS Safari
  useEffect(() => {
    const setAppHeight = () => document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
    setAppHeight();
    window.addEventListener('resize', setAppHeight);
    window.addEventListener('orientationchange', () => setTimeout(setAppHeight, 100));
    return () => {
      window.removeEventListener('resize', setAppHeight);
      window.removeEventListener('orientationchange', setAppHeight);
    };
  }, []);

  // Restore from localStorage
  useEffect(() => {
    const savedHoleIdx = localStorage.getItem(`${storagePrefix}holeIdx`);
    const savedStartCourse = localStorage.getItem(`${storagePrefix}startCourse`);
    const savedGroupName = localStorage.getItem(`${storagePrefix}groupName`);
    if (savedHoleIdx !== null) setCurrentHoleIdx(parseInt(savedHoleIdx));
    if (savedStartCourse) setStartCourse(savedStartCourse);
    if (savedGroupName) setSelectedGroupName(savedGroupName);
    if (!savedStartCourse) setModalStep('group');
    setIsInitialized(true);
  }, [storagePrefix]);

  // Persist to localStorage
  useEffect(() => { if (isInitialized) localStorage.setItem(`${storagePrefix}holeIdx`, currentHoleIdx); }, [currentHoleIdx, isInitialized, storagePrefix]);
  useEffect(() => { if (isInitialized) localStorage.setItem(`${storagePrefix}startCourse`, startCourse); }, [startCourse, isInitialized, storagePrefix]);
  useEffect(() => { if (isInitialized) localStorage.setItem(`${storagePrefix}groupName`, selectedGroupName); }, [selectedGroupName, isInitialized, storagePrefix]);

  const handleGroupSelect = (group) => {
    setStartCourse(group.start || 'valley');
    setSelectedGroupName(group.course ? `${group.course}조` : group.players?.split('/')[0] || '');
    setCurrentHoleIdx(group.start === 'lake' ? 9 : 0);
    setModalStep(null);
    setTutorialStep(1);
  };

  const nextTutorial = () => { if (tutorialStep < 4) setTutorialStep(s => s + 1); else setTutorialStep(0); };

  const TUTORIAL_DATA = {
    1: { id: 'step-hole', text: '홀 번호를 누르면 원하는 홀로 바로 이동할 수 있습니다.', pos: 'bottom' },
    2: { id: 'step-home', text: '홈 버튼을 누르면 행사 안내 페이지로 돌아갑니다.', pos: 'bottom' },
    3: { id: 'step-green', text: '그린 라이를 누르면 전체 화면으로 크게 볼 수 있습니다.', pos: 'top' },
    4: { id: 'step-nav', text: '이전 홀과 다음 홀로 빠르게 이동합니다.', pos: 'top' },
  };

  return (
    <div className="record-container">
      {/* ── 상단바 ── */}
      <div className="topmenu">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.44rem 0.8rem', maxWidth: '600px', margin: '0 auto' }}>
          {/* 좌: 홀 정보 */}
          <div id="step-hole" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '2px 6px', borderRadius: '4px' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', color: 'white', fontWeight: 'bold' }}>
              <span onClick={() => setShowHoleSelectModal(true)} style={{ color: 'var(--accent-neon)', cursor: 'pointer' }}>
                {getDisplayHoleNumber(currentHole.hole)}H ▾
              </span>
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              <span onClick={() => setModalStep('group')} style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1, cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,0.2)' }}>
                {selectedGroupName}
              </span>
              <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1 }}>{courseSectionName(currentHole.hole)} PAR {currentHole.par}</span>
            </div>
          </div>

          {/* 중: 코스명 */}
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '600' }}>{courseName || ''}</div>

          {/* 우: 버튼들 */}
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button onClick={() => setTutorialStep(1)} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontSize: '0.8rem', padding: '0.2rem 0.5rem', borderRadius: '5px', color: 'rgba(255,255,255,0.8)', fontWeight: 'bold' }}>?</button>
            <button id="step-home" onClick={() => router.push(`/go/${encodeURIComponent(slug)}`)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', fontSize: '0.9rem', padding: '0.2rem 0.4rem', borderRadius: '5px' }}>🏠</button>
          </div>
        </div>
      </div>

      {/* ── 야디지 ── */}
      <div className="hole-yardage-container">
        <YardageDrawingBoard yardageSrc={yardageSrc} />
      </div>

      {/* ── 우하단: 그린 + 이동 버튼 ── */}
      <div style={{ position: 'absolute', bottom: '20px', right: '20px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.6rem', zIndex: 10 }}>
        {/* 그린 썸네일 */}
        {greenImgSrc && (
          <div id="step-green" onClick={() => setShowGreenModal(true)} style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(16,185,129,0.4)', background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(6px)', width: '90px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', cursor: 'pointer' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--accent-neon)', textAlign: 'center', padding: '0.3rem 0', fontWeight: 'bold' }}>GREEN</div>
            <img src={greenImgSrc} alt="Green" style={{ width: '100%', height: 'auto', display: 'block', pointerEvents: 'none' }} onError={(e) => e.target.style.display = 'none'} />
          </div>
        )}

        {/* 홀 이동 버튼 */}
        <div id="step-nav" style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn" style={{ width: '55px', height: '55px', borderRadius: '50%', padding: 0, background: 'rgba(15,23,42,0.9)', border: '2px solid var(--accent-neon)', boxShadow: '0 0 15px rgba(16,185,129,0.4)', color: 'var(--accent-neon)', fontSize: '1.2rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(4px)' }} onClick={() => setCurrentHoleIdx(i => (i - 1 + 18) % 18)}>◀</button>
          <button className="btn" style={{ width: '55px', height: '55px', borderRadius: '50%', padding: 0, background: 'var(--accent-neon)', border: '2px solid var(--accent-neon)', boxShadow: '0 0 20px rgba(16,185,129,0.6)', color: '#050806', fontSize: '1.2rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} onClick={() => setCurrentHoleIdx(i => (i + 1) % 18)}>▶</button>
        </div>
      </div>

      {/* ── 홀 선택 모달 ── */}
      {showHoleSelectModal && (
        <div className="modal-overlay" onClick={() => setShowHoleSelectModal(false)} style={{ zIndex: 100 }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '320px' }}>
            <h3 style={{ marginTop: 0, color: 'var(--accent-neon)', textAlign: 'center' }}>홀 선택</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '4px' }}>
              <div style={{ textAlign: 'center', fontSize: '0.7rem', fontWeight: 'bold', color: startCourse === 'valley' ? 'var(--accent-neon)' : '#38bdf8', paddingBottom: '4px', borderBottom: `1px solid ${startCourse === 'valley' ? 'rgba(16,185,129,0.3)' : 'rgba(56,189,248,0.3)'}` }}>{startCourse === 'valley' ? 'VALLEY' : 'LAKE'}</div>
              <div style={{ textAlign: 'center', fontSize: '0.7rem', fontWeight: 'bold', color: startCourse === 'valley' ? '#38bdf8' : 'var(--accent-neon)', paddingBottom: '4px', borderBottom: `1px solid ${startCourse === 'valley' ? 'rgba(56,189,248,0.3)' : 'rgba(16,185,129,0.3)'}` }}>{startCourse === 'valley' ? 'LAKE' : 'VALLEY'}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateRows: 'repeat(9, auto)', gridAutoFlow: 'column', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
              {(startCourse === 'valley' ? initialHoles : [...initialHoles.slice(9), ...initialHoles.slice(0, 9)]).map((h, i) => (
                <button key={i} className={`btn ${currentHole.hole === h.hole ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '0.75rem 0' }}
                  onClick={() => { setCurrentHoleIdx(initialHoles.findIndex(item => item.hole === h.hole)); setShowHoleSelectModal(false); }}>
                  {getDisplayHoleNumber(h.hole)}H
                </button>
              ))}
            </div>
            <button className="btn btn-secondary" style={{ width: '100%', marginTop: '1rem' }} onClick={() => setShowHoleSelectModal(false)}>닫기</button>
          </div>
        </div>
      )}

      {/* ── 그린 전체화면 모달 ── */}
      {showGreenModal && greenImgSrc && (
        <div onClick={() => setShowGreenModal(false)} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button onClick={() => setShowGreenModal(false)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '50%', width: '40px', height: '40px', color: 'white', fontSize: '1.2rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 301 }}>✕</button>
          <img src={greenImgSrc} alt="Green 전체화면" onClick={e => e.stopPropagation()} style={{ maxWidth: '92vw', maxHeight: '92vh', width: 'auto', height: 'auto', borderRadius: '12px', boxShadow: '0 8px 40px rgba(0,0,0,0.6)', objectFit: 'contain' }} />
        </div>
      )}

      {/* ── 조 선택 모달 ── */}
      {modalStep === 'group' && (
        <div className="modal-overlay" style={{ zIndex: 200 }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '340px', textAlign: 'center', padding: '1.5rem' }}>
            <h3 style={{ marginTop: 0, color: 'var(--accent-neon)' }}>조 선택</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.2rem', fontSize: '0.9rem' }}>소속된 조를 선택해 주세요.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
              {groups.length > 0 ? groups.map((g, i) => (
                <button key={i} onClick={() => handleGroupSelect(g)} style={{ padding: '1.2rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                  <div style={{ fontWeight: 'bold', color: (g.start || 'valley') === 'valley' ? 'var(--accent-neon)' : '#38bdf8', fontSize: '1rem', marginBottom: '0.3rem' }}>
                    {g.course || `${i + 1}조`} ({(g.start || 'valley') === 'valley' ? '밸리 코스 시작' : '레이크 코스 시작'})
                  </div>
                  <div style={{ fontSize: '0.95rem', color: '#fff', fontWeight: '500' }}>{g.players}</div>
                  {g.time && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>티오프 {g.time}</div>}
                </button>
              )) : (
                // 조편성 없으면 간단 시작
                <>
                  <button onClick={() => handleGroupSelect({ start: 'valley' })} style={{ padding: '1rem', borderRadius: '14px', border: '1px solid var(--accent-neon)', background: 'rgba(16,185,129,0.1)', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>🟢 밸리 코스 시작 (1홀)</button>
                  <button onClick={() => handleGroupSelect({ start: 'lake' })} style={{ padding: '1rem', borderRadius: '14px', border: '1px solid #38bdf8', background: 'rgba(56,189,248,0.1)', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>🔵 레이크 코스 시작 (10홀)</button>
                </>
              )}
            </div>
            {selectedGroupName && (
              <button onClick={() => setModalStep(null)} style={{ marginTop: '1.5rem', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.9rem', textDecoration: 'underline' }}>닫기</button>
            )}
          </div>
        </div>
      )}

      {/* ── 튜토리얼 스포트라이트 ── */}
      {tutorialStep > 0 && (
        <TutorialSpotlight step={tutorialStep} data={TUTORIAL_DATA[tutorialStep]} onNext={nextTutorial} totalSteps={4} />
      )}
    </div>
  );
}

function TutorialSpotlight({ step, data, onNext, totalSteps }) {
  const [rect, setRect] = useState(null);
  useEffect(() => {
    const el = document.getElementById(data.id);
    if (el) setRect(el.getBoundingClientRect());
  }, [step, data.id]);
  if (!rect) return null;

  const pad = 8;
  const top = rect.top - pad;
  const left = rect.left - pad;
  const width = rect.width + pad * 2;
  const height = rect.height + pad * 2;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, pointerEvents: 'auto' }}>
      <svg style={{ position: 'absolute', width: '100%', height: '100%' }}>
        <defs>
          <mask id="spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect x={left} y={top} width={width} height={height} rx="10" ry="10" fill="black" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.8)" mask="url(#spotlight-mask)" />
        <rect x={left} y={top} width={width} height={height} rx="10" ry="10" fill="none" stroke="var(--accent-neon)" strokeWidth="3" style={{ filter: 'drop-shadow(0 0 8px var(--accent-neon))' }} />
      </svg>
      <div style={{ position: 'absolute', top: data.pos === 'bottom' ? `${top + height + 20}px` : 'auto', bottom: data.pos === 'top' ? `${window.innerHeight - top + 20}px` : 'auto', left: '50%', transform: 'translateX(-50%)', width: '280px', background: 'white', borderRadius: '15px', padding: '1.2rem', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', zIndex: 501, textAlign: 'center' }}>
        <div style={{ color: 'var(--accent-neon)', fontWeight: 'bold', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Step {step} / {totalSteps}</div>
        <div style={{ color: '#1e293b', fontSize: '0.95rem', lineHeight: '1.5', fontWeight: '500', marginBottom: '1.2rem' }}>{data.text}</div>
        <button onClick={onNext} style={{ width: '100%', padding: '0.8rem', background: '#1e293b', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
          {step === totalSteps ? '가이드 완료' : '다음으로'}
        </button>
      </div>
    </div>
  );
}
