'use client';

import { useState } from 'react';
import DrawingView from './DrawingView';
import HoleMap from './HoleMap';

export default function HoleViewer({ hole, round, courses, mode, onModeChange, onPhotoClick, onExpand }) {
  const [mapType, setMapType] = useState('normal');

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {mode === 'drawing'
        ? <DrawingView hole={hole} round={round} courses={courses} />
        : <HoleMap hole={hole} round={round} onPhotoClick={onPhotoClick} mapType={mapType} />}

      {/* Tab toggles (top-right) */}
      <div style={{
        position: 'absolute', top: '8px', right: '8px', zIndex: 12,
        display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end'
      }}>
        {/* 그림 / 지도 */}
        <div style={{
          display: 'flex', background: 'rgba(0,0,0,0.65)',
          border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', overflow: 'hidden'
        }}>
          <button
            onClick={(e) => { e.stopPropagation(); onModeChange('drawing'); }}
            style={tabBtn(mode === 'drawing')}
          >그림</button>
          <button
            onClick={(e) => { e.stopPropagation(); onModeChange('map'); }}
            style={tabBtn(mode === 'map')}
          >지도</button>
        </div>

        {/* 일반 / 위성 (지도 모드일 때만) */}
        {mode === 'map' && (
          <div style={{
            display: 'flex', background: 'rgba(0,0,0,0.65)',
            border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', overflow: 'hidden'
          }}>
            <button
              onClick={(e) => { e.stopPropagation(); setMapType('normal'); }}
              style={tabBtn(mapType === 'normal')}
            >일반</button>
            <button
              onClick={(e) => { e.stopPropagation(); setMapType('satellite'); }}
              style={tabBtn(mapType === 'satellite')}
            >위성</button>
          </div>
        )}
      </div>

      {/* Expand button (above zoom controls when in map mode) */}
      {onExpand && (
        <button
          onClick={(e) => { e.stopPropagation(); onExpand(); }}
          title="크게 보기"
          style={{
            position: 'absolute',
            bottom: mode === 'map' ? '78px' : '8px',
            right: '8px', zIndex: 11,
            background: 'rgba(0,0,0,0.65)', color: 'white',
            border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px',
            width: '32px', height: '32px', fontSize: '1rem',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
        >⛶</button>
      )}
    </div>
  );
}

function tabBtn(active) {
  return {
    background: active ? 'var(--accent-neon)' : 'transparent',
    color: active ? 'black' : 'white',
    border: 'none', padding: '4px 10px',
    fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer'
  };
}
