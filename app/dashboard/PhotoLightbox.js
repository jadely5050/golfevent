'use client';

import { useEffect } from 'react';

export default function PhotoLightbox({ image, onClose, onHoleChange, isSaving }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!image) return null;

  const time = image.addedAt ? new Date(image.addedAt).toLocaleString('ko-KR') : '시간 정보 없음';
  const gps = (image.latitude && image.longitude)
    ? `📍 ${Number(image.latitude).toFixed(6)}, ${Number(image.longitude).toFixed(6)}`
    : '📍 GPS 정보 없음';

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 2000 }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        position: 'relative', maxWidth: '95vw', maxHeight: '95vh',
        background: 'rgba(15,23,42,0.95)', border: '1px solid var(--accent-neon)',
        borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem'
      }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: '8px', right: '8px',
          background: 'rgba(0,0,0,0.5)', border: 'none', color: 'white',
          fontSize: '1.5rem', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer',
          zIndex: 10
        }}>×</button>

        <img
          src={image.url}
          alt={`Hole ${image.hole}`}
          style={{ maxWidth: '90vw', maxHeight: '70vh', objectFit: 'contain', borderRadius: '6px', display: 'block', alignSelf: 'center' }}
        />

        <div style={{ color: 'white', fontSize: '0.85rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            Hole:
            <select
              value={image.hole}
              disabled={isSaving || !onHoleChange}
              onChange={(e) => onHoleChange && onHoleChange(image.id, parseInt(e.target.value, 10))}
              style={{
                background: '#334155', color: 'white', border: '1px solid var(--accent-neon)',
                borderRadius: '4px', padding: '4px 8px', fontSize: '0.85rem'
              }}
            >
              {Array.from({ length: 18 }, (_, i) => i + 1).map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            {isSaving && <span style={{ color: 'var(--accent-neon)', fontSize: '0.75rem' }}>저장 중...</span>}
          </label>
          <span style={{ color: 'var(--text-secondary)' }}>{time}</span>
          <span style={{ color: 'var(--text-secondary)' }}>{gps}</span>
        </div>
      </div>
    </div>
  );
}
