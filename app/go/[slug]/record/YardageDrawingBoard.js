'use client';

import { useState, useRef, useEffect } from 'react';
import { track } from '@vercel/analytics';

export default function YardageDrawingBoard({ yardageSrc, undulationSrc, slug, hole }) {
  const [scale, setScale] = useState(1);
  const [showUndulationModal, setShowUndulationModal] = useState(false);
  const containerRef = useRef(null);
  const initialPinchDist = useRef(null);

  useEffect(() => { setScale(1); }, [yardageSrc]);
  useEffect(() => { setShowUndulationModal(false); }, [undulationSrc]);

  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      initialPinchDist.current = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && initialPinchDist.current) {
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setScale(prev => Math.min(Math.max(prev * (dist / initialPinchDist.current), 1), 5));
      initialPinchDist.current = dist;
    }
  };

  const handleTouchEnd = () => { initialPinchDist.current = null; };

  return (
    <div
      className="drawing-board-container"
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ overflow: 'hidden', height: '100%', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', WebkitOverflowScrolling: 'touch' }}
    >
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'center top', flex: undulationSrc ? '0 0 auto' : '1 1 auto', minHeight: 0, width: '100%', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', transition: 'transform 0.1s ease-out' }}>
        {yardageSrc ? (
          <img
            src={yardageSrc}
            alt="야디지"
            style={{ maxWidth: '100%', maxHeight: undulationSrc ? 'none' : '100%', width: undulationSrc ? '100%' : 'auto', height: 'auto', objectFit: 'contain', objectPosition: 'center top', display: 'block', pointerEvents: 'none', userSelect: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', borderRadius: '4px' }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>이미지 없음</div>
        )}
      </div>

      {undulationSrc && (
        // 우하단 공략/그린 썸네일과 안 겹치도록 폭을 고정하고, 왼쪽에 붙여서 야디지 바로 아래에 배치한다.
        // 누르면 그린처럼 전체화면 모달로 크게 볼 수 있다.
        <div
          id="step-undulation"
          onClick={() => { setShowUndulationModal(true); track('언듈레이션_클릭', { slug, hole }); }}
          style={{ flex: '1 1 auto', alignSelf: 'flex-start', minHeight: 0, width: '64%', maxWidth: '64%', marginRight: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '0.3rem 0 0.4rem 0.75rem', overflow: 'hidden', boxSizing: 'border-box', cursor: 'pointer', pointerEvents: 'auto' }}
        >
          <div style={{ fontSize: '0.65rem', color: '#38bdf8', fontWeight: 'bold', marginBottom: '2px' }}>언듈레이션</div>
          <img
            src={undulationSrc}
            alt="언듈레이션"
            style={{ maxWidth: '100%', maxHeight: 'calc(100% - 16px)', objectFit: 'contain', objectPosition: 'left top', display: 'block', borderRadius: '4px', pointerEvents: 'none' }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        </div>
      )}

      {showUndulationModal && undulationSrc && (
        <div onClick={() => setShowUndulationModal(false)} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'auto' }}>
          <button onClick={() => setShowUndulationModal(false)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '50%', width: '40px', height: '40px', color: 'white', fontSize: '1.2rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 301 }}>✕</button>
          <img src={undulationSrc} alt="언듈레이션 전체화면" onClick={e => e.stopPropagation()} style={{ maxWidth: '92vw', maxHeight: '92vh', width: 'auto', height: 'auto', borderRadius: '12px', boxShadow: '0 8px 40px rgba(0,0,0,0.6)', objectFit: 'contain' }} />
        </div>
      )}
    </div>
  );
}
