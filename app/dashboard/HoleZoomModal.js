'use client';

import { useEffect } from 'react';
import HoleViewer from './HoleViewer';

export default function HoleZoomModal({ hole, round, courses, mode, onModeChange, onPhotoClick, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1500 }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '80vw', height: '80vh',
          background: '#0f172a', border: '1px solid var(--accent-neon)',
          borderRadius: '12px', overflow: 'hidden'
        }}
      >
        <HoleViewer
          hole={hole}
          round={round}
          courses={courses}
          mode={mode}
          onModeChange={onModeChange}
          onPhotoClick={onPhotoClick}
        />
        <button
          onClick={onClose}
          title="닫기"
          style={{
            position: 'absolute', top: '8px', left: '8px', zIndex: 13,
            background: 'rgba(0,0,0,0.65)', color: 'white',
            border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px',
            width: '32px', height: '32px', fontSize: '1.1rem',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
        >×</button>
      </div>
    </div>
  );
}
