'use client';

import { useState, useRef, useEffect } from 'react';

export default function YardageDrawingBoard({ yardageSrc }) {
  const [scale, setScale] = useState(1);
  const containerRef = useRef(null);
  const initialPinchDist = useRef(null);

  useEffect(() => { setScale(1); }, [yardageSrc]);

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
      style={{ overflow: 'hidden', height: '100%', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', WebkitOverflowScrolling: 'touch' }}
    >
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'center top', width: '100%', height: '100%', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', transition: 'transform 0.1s ease-out' }}>
        {yardageSrc ? (
          <img
            src={yardageSrc}
            alt="야디지"
            style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', objectFit: 'contain', objectPosition: 'center top', display: 'block', pointerEvents: 'none', userSelect: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', borderRadius: '4px' }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>이미지 없음</div>
        )}
      </div>
    </div>
  );
}
